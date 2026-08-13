import { Request, Response } from "express";
import QRCode from "qrcode";
import database_models from "../database/config/db.config";
import cloudinary from "../helpers/cloudinary";
import { WalletItemCreationAttributes } from "../types/model";

const {
  Wallet,
  WalletItem,
  WalletRestriction,
  Category,
  ActionPurchase,
  QRObject,
  Action,
  SubAction,
} = database_models;

type EntityType = "user" | "organization";

type UploadedWalletFile = {
  fileUrl: string;
  fileType: "image" | "pdf" | "file";
  fileName: string;
};

/**
 * Upload an attached wallet-item file (photo or PDF) to Cloudinary.
 * resource_type "auto" lets Cloudinary store/serve both images and PDFs, and
 * we avoid image-only transformations so a PDF survives intact.
 */
const uploadWalletFile = async (file: any): Promise<UploadedWalletFile> => {
  const ext = (file.originalname?.split(".").pop() || "").toLowerCase();
  const mime = file.mimetype || "";
  const isPdf = ext === "pdf" || mime === "application/pdf";
  const isImage = mime.startsWith("image/");

  const result = await cloudinary.uploader.upload(file.path, {
    folder: "wallet-items",
    resource_type: "auto",
  });

  return {
    fileUrl: result.secure_url,
    fileType: isPdf ? "pdf" : isImage ? "image" : "file",
    fileName: file.originalname || "attachment",
  };
};

/** Multipart bodies deliver JSON fields as strings — parse them defensively. */
const parseMaybeJson = (value: any): any => {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

/**
 * Merge base metadata with an uploaded file and, for loyalty/membership cards,
 * a scannable QR of the card number so it can be shown at a merchant.
 */
const buildMetadata = async (
  base: any,
  itemType: string,
  cardNumber: string | undefined,
  uploaded: UploadedWalletFile | null
): Promise<any> => {
  const meta: any = { ...(base || {}) };
  if (uploaded) {
    meta.fileUrl = uploaded.fileUrl;
    meta.fileType = uploaded.fileType;
    meta.fileName = uploaded.fileName;
  }
  if (cardNumber) meta.cardNumber = cardNumber;
  if (itemType === "custom_card" && meta.cardNumber) {
    try {
      meta.cardQr = await QRCode.toDataURL(String(meta.cardNumber), { margin: 1 });
    } catch {
      /* QR generation is best-effort */
    }
  } else if (!meta.cardNumber) {
    delete meta.cardQr;
  }
  return meta;
};

/**
 * Resolve the active Wallet row for a user or organization.
 * Returns null when no active wallet exists.
 */
const resolveWallet = async (entityType: EntityType, entityId: string) => {
  const where =
    entityType === "organization"
      ? { organizationId: entityId, isActive: true }
      : { userId: entityId, isActive: true };
  return Wallet.findOne({ where });
};

/**
 * GET /wallets/:entityType/:entityId/summary
 *
 * Single data source for the wallet page. Aggregates — never duplicates — the
 * monetary balance, restricted categories, purchased actions/tickets and the
 * generic WalletItems, so the client makes one call.
 */
const getWalletSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.params as {
      entityType: EntityType;
      entityId: string;
    };

    if (entityType !== "user" && entityType !== "organization") {
      res.status(400).json({
        success: false,
        message: "entityType must be 'user' or 'organization'",
      });
      return;
    }

    // Guard against a missing/malformed id so a bad request never 500s on the
    // database ("invalid input syntax for type uuid" / undefined WHERE value).
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!entityId || entityId === "undefined" || !UUID_RE.test(entityId)) {
      res.status(400).json({
        success: false,
        message: "A valid entityId is required",
      });
      return;
    }

    const wallet = await resolveWallet(entityType, entityId);
    if (!wallet) {
      res.status(404).json({
        success: false,
        message: `Active wallet not found for this ${entityType}`,
      });
      return;
    }

    const walletId = wallet.id;

    // Restricted categories + balance breakdown
    const restrictions = await WalletRestriction.findAll({
      where: { walletId },
      include: [{ model: Category, as: "category", required: false }],
      order: [["createdAt", "DESC"]],
    });

    const num = (v: any) => {
      const n = parseFloat(String(v ?? 0));
      return Number.isFinite(n) ? n : 0;
    };
    const totalBalance = num(wallet.balance);
    const totalRestrictedAmount = restrictions.reduce(
      (sum: number, r: any) => sum + num(r.amount),
      0
    );

    // Purchased actions / tickets (canonical records live in ActionPurchases).
    // Users own purchases via buyerId; organizations via organizationId.
    const purchaseWhere =
      entityType === "organization"
        ? { organizationId: entityId }
        : { buyerId: entityId };
    const purchases = await ActionPurchase.findAll({
      where: purchaseWhere,
      include: [
        {
          model: Action,
          as: "action",
          attributes: ["id", "name", "type", "coverImage", "currency"],
          required: false,
        },
        {
          model: SubAction,
          as: "subAction",
          attributes: ["id", "name", "coverImage"],
          required: false,
        },
        {
          model: QRObject,
          as: "qrObject",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Generic wallet items (vouchers, passes, saved actions, custom cards…)
    const items = await WalletItem.findAll({
      where: { walletId },
      order: [
        ["isPinned", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          id: wallet.id,
          balance: totalBalance,
          currency: wallet.currency,
          isActive: wallet.isActive,
          entityType,
          entityId,
        },
        balanceBreakdown: {
          total: totalBalance,
          restricted: totalRestrictedAmount,
          available: totalBalance - totalRestrictedAmount,
        },
        restrictions: restrictions.map((r: any) => ({
          id: r.id,
          categoryId: r.categoryId,
          categoryName: r.category?.name ?? null,
          categoryDescription: r.category?.description ?? null,
          amount: parseFloat(r.amount.toString()),
        })),
        purchases,
        items,
      },
    });
  } catch (error: any) {
    console.error("Error in getWalletSummary:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while building the wallet summary",
      error: error.message,
    });
  }
};

/**
 * GET /wallets/:walletId/items
 */
const listWalletItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;
    const { status, itemType } = req.query;

    const where: any = { walletId };
    if (status) where.status = status;
    if (itemType) where.itemType = itemType;

    const items = await WalletItem.findAll({
      where,
      order: [
        ["isPinned", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.status(200).json({
      success: true,
      message: "Wallet items retrieved successfully",
      data: items,
    });
  } catch (error: any) {
    console.error("Error in listWalletItems:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving wallet items",
      error: error.message,
    });
  }
};

/**
 * POST /wallets/:walletId/items
 */
const createWalletItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;
    const { itemType, title, subtitle, imageUrl, metadata, referenceId, expiresAt, cardNumber } =
      req.body;

    if (!itemType || !title) {
      res.status(400).json({
        success: false,
        message: "itemType and title are required",
      });
      return;
    }

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }

    // An optional attachment (photo or PDF) arrives as multipart `file`.
    let uploaded: UploadedWalletFile | null = null;
    if ((req as any).file) {
      try {
        uploaded = await uploadWalletFile((req as any).file);
      } catch (uploadErr: any) {
        console.error("Wallet item file upload failed:", uploadErr);
        res.status(400).json({
          success: false,
          message: "Could not upload the attached file",
        });
        return;
      }
    }

    const mergedMeta = await buildMetadata(
      parseMaybeJson(metadata),
      itemType,
      cardNumber,
      uploaded
    );

    const payload: WalletItemCreationAttributes = {
      walletId,
      itemType,
      title,
      subtitle: subtitle ?? null,
      // Prefer an explicit imageUrl; otherwise use an uploaded image as the thumbnail
      imageUrl: imageUrl ?? (uploaded?.fileType === "image" ? uploaded.fileUrl : null),
      referenceId: referenceId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      metadata: mergedMeta,
    };

    const item = await WalletItem.create(payload);

    res.status(201).json({
      success: true,
      message: "Wallet item created successfully",
      data: item,
    });
  } catch (error: any) {
    console.error("Error in createWalletItem:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the wallet item",
      error: error.message,
    });
  }
};

/**
 * PATCH /wallets/items/:itemId
 * Supports updating status, pin state and presentation fields.
 */
const updateWalletItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await WalletItem.findByPk(itemId);
    if (!item) {
      res.status(404).json({ success: false, message: "Wallet item not found" });
      return;
    }

    const editable = [
      "title",
      "subtitle",
      "imageUrl",
      "status",
      "isPinned",
      "expiresAt",
    ] as const;

    const updates: any = {};
    for (const key of editable) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.expiresAt) updates.expiresAt = new Date(updates.expiresAt);

    // Optional new/replacement attachment (photo or PDF)
    let uploaded: UploadedWalletFile | null = null;
    if ((req as any).file) {
      try {
        uploaded = await uploadWalletFile((req as any).file);
      } catch (uploadErr: any) {
        console.error("Wallet item file upload failed:", uploadErr);
        res.status(400).json({
          success: false,
          message: "Could not upload the attached file",
        });
        return;
      }
    }

    // Rebuild metadata when a file, card number or explicit metadata is provided
    const { metadata, cardNumber } = req.body;
    if (uploaded || cardNumber !== undefined || metadata !== undefined) {
      const base = metadata !== undefined ? parseMaybeJson(metadata) : (item as any).metadata || {};
      updates.metadata = await buildMetadata(base, item.itemType, cardNumber, uploaded);
      if (uploaded?.fileType === "image" && updates.imageUrl === undefined) {
        updates.imageUrl = uploaded.fileUrl;
      }
    }

    await item.update(updates);

    res.status(200).json({
      success: true,
      message: "Wallet item updated successfully",
      data: item,
    });
  } catch (error: any) {
    console.error("Error in updateWalletItem:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the wallet item",
      error: error.message,
    });
  }
};

/**
 * DELETE /wallets/items/:itemId
 */
const deleteWalletItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await WalletItem.findByPk(itemId);
    if (!item) {
      res.status(404).json({ success: false, message: "Wallet item not found" });
      return;
    }

    await item.destroy();

    res.status(200).json({
      success: true,
      message: "Wallet item deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteWalletItem:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the wallet item",
      error: error.message,
    });
  }
};

export default {
  getWalletSummary,
  listWalletItems,
  createWalletItem,
  updateWalletItem,
  deleteWalletItem,
};
