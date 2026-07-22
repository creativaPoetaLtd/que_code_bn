import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ActionCreationAttributes,
  ActionModelAttributes,
  SubActionCreationAttributes,
  SubActionModelAttributes,
} from "../types/model";
import { Op } from "sequelize";
import cloudinary from "../helpers/cloudinary";
import QRCode from "qrcode";

import { SUB_ACTION_MAX_GALLERY_IMAGES } from "../middleware/multer";
import { normalizeMetadata, withNormalizedMetadata } from "../utils/metadata";

// Upload a multer file (buffer or disk path) to Cloudinary and return its URL
const uploadImageToCloudinary = async (
  file: Express.Multer.File,
  folder: string
): Promise<string> => {
  const options = {
    folder,
    transformation: [
      { width: 1200, height: 630, crop: "fill", gravity: "auto" },
      { quality: "auto", format: "auto" },
    ],
  };

  let uploadResult: any;
  if ((file as any).buffer && (file as any).buffer.length > 0) {
    uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end((file as any).buffer);
    });
  } else if ((file as any).path) {
    uploadResult = await cloudinary.uploader.upload((file as any).path, options);
  } else {
    throw new Error("Empty file");
  }

  return uploadResult.secure_url;
};

// Multipart bodies deliver objects/arrays as JSON strings — parse them back
const parseJsonField = <T>(value: any, fallback: T): T => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isHttpUrl = (value: unknown): boolean =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

// Keep only well-formed image URLs, deduped and capped
const sanitizeImageUrls = (value: any): string[] => {
  const list = parseJsonField<any>(value, []);
  if (!Array.isArray(list)) return [];
  return Array.from(
    new Set(
      list
        .filter((url): url is string => isHttpUrl(url))
        .map((url) => url.trim())
    )
  ).slice(0, SUB_ACTION_MAX_GALLERY_IMAGES);
};

const SOCIAL_LINK_HOSTS: Record<string, string> = {
  instagram: "instagram.com",
  x: "x.com",
};

// Accept "@handle", "handle" or a full profile URL; store a canonical profile URL
const normalizeSocialLink = (
  platform: "instagram" | "x",
  value: unknown
): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  if (isHttpUrl(raw)) {
    let host: string;
    try {
      host = new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return null;
    }
    const allowedHosts =
      platform === "x"
        ? ["x.com", "twitter.com"]
        : ["instagram.com"];
    return allowedHosts.includes(host) ? raw : null;
  }

  const handle = raw.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://${SOCIAL_LINK_HOSTS[platform]}/${handle}`;
};

const normalizeSocialLinks = (value: any): Record<string, string> | null => {
  const links = parseJsonField<any>(value, null);
  if (!links || typeof links !== "object") return null;

  const normalized: Record<string, string> = {};
  const instagram = normalizeSocialLink("instagram", links.instagram);
  const x = normalizeSocialLink("x", links.x);
  if (instagram) normalized.instagram = instagram;
  if (x) normalized.x = x;
  return normalized;
};

// Sub-action metadata may arrive as a JSON string (multipart) and may carry social links
const prepareSubActionMetadata = (value: any): Record<string, any> => {
  const metadata = normalizeMetadata(parseJsonField<Record<string, any>>(value, {}));

  if (metadata.socialLinks !== undefined) {
    const socialLinks = normalizeSocialLinks(metadata.socialLinks);
    if (socialLinks && Object.keys(socialLinks).length > 0) {
      metadata.socialLinks = socialLinks;
    } else {
      delete metadata.socialLinks;
    }
  }

  return metadata;
};

// Helper to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Step A: Type & Basic Information
const createActionStepA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const {
      type,
      name,
      slug,
      displayLayout,
      coverImage, // Can be URL if provided directly, or will be uploaded from file
      shortDescription,
      description,
      dedicatedQrCode,
      metadata,
    } = req.body;

    if (!type || !name) {
      res.status(400).json({
        message: "Type and name are required",
      });
      return;
    }

    const validTypes = [
      "ticket",
      "transport",
      "service",
      "subscription",
      "payment",
      "donation",
      "vote",
      "booking",
      "license",
      "membership",
      "rental",
      "group",
    ];

    if (!validTypes.includes(type)) {
      res.status(400).json({
        message: "Invalid action type",
        validTypes,
      });
      return;
    }

    const actionSlug = slug || generateSlug(name);

    // Check if slug already exists
    const existingAction = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { slug: actionSlug } }
    );

    if (existingAction) {
      res.status(400).json({
        message: "An action with this slug already exists",
        suggestedSlug: `${actionSlug}-${Date.now()}`,
      });
      return;
    }

    // Handle cover image upload to Cloudinary
    let coverImageUrl: string | null = coverImage || null;

    // Check for file in req.file (when using .single()) or req.files (when using .fields())
    const coverFile = (req as any).file || (req.files as { [fieldname: string]: Express.Multer.File[] })?.coverImage?.[0];
    
    if (coverFile) {
      try {

        // Upload cover image to Cloudinary
        let uploadResult: any;
        if ((coverFile as any).buffer && (coverFile as any).buffer.length > 0) {
          // Upload from buffer
          uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: 'actions/cover-images',
                transformation: [
                  { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
                  { quality: 'auto', format: 'auto' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end((coverFile as any).buffer);
          });
        } else if ((coverFile as any).path) {
          // Upload from file path
          uploadResult = await cloudinary.uploader.upload((coverFile as any).path, {
            folder: 'actions/cover-images',
            transformation: [
              { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', format: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }

        coverImageUrl = uploadResult.secure_url;
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    // Availability can be:
    // - {} (empty) = always available, no restrictions
    // - { mode: 'always' } = explicitly always available
    // - { mode: 'scheduled', startDate: Date, endDate?: Date } = scheduled with optional end date
    // Actions without endDate remain available indefinitely from startDate
    const actionData: ActionCreationAttributes = {
      organizationId,
      type,
      name,
      slug: actionSlug,
      displayLayout: displayLayout || "card",
      coverImage: coverImageUrl,
      shortDescription: shortDescription || null,
      description: description || null,
      currency: "RWF",
      taxProfileId: null,
      pricing: { mode: "fixed", amount: 0 },
      availability: {}, // Empty = always available
      visibility: { mode: "public" },
      buyerFields: [],
      fulfillment: { storeOnBuyerQR: false },
      policy: {},
      webhooks: {},
      customFields: {},
      metadata: metadata || {},
      status: "draft",
      dedicatedQrCode: dedicatedQrCode || null,
      dedicatedQrCodeData: null,
    };

    const newAction = await insert_function<ActionModelAttributes>(
      "Action",
      "create",
      actionData
    );

    // Generate QR code for the action
    try {
      const actionQrLink = `${process.env.FRONTEND_URL || 'https://app.quecode.ai'}/action/${newAction.id}`;
      const qrCodeData = await QRCode.toDataURL(actionQrLink);
      
      // Update the action with the generated QR code
      await insert_function<ActionModelAttributes>(
        "Action",
        "update",
        { dedicatedQrCodeData: qrCodeData },
        { where: { id: newAction.id } }
      );

      // Fetch the updated action to return
      const updatedAction = await read_function<ActionModelAttributes>(
        "Action",
        "findOne",
        { where: { id: newAction.id } }
      );

      res.status(201).json({
        message: "Action created successfully (Step A)",
        data: updatedAction,
      });
    } catch (qrError: any) {
      console.error("Error generating QR code for action:", qrError);
      // Still return the action even if QR code generation fails
      res.status(201).json({
        message: "Action created successfully (Step A) - QR code generation failed",
        data: newAction,
        qrError: qrError.message,
      });
    }
  } catch (error: any) {
    console.error("Error in createActionStepA:", error);
    res.status(500).json({
      message: "An error occurred while creating the action",
      error: error.message,
    });
  }
};

// Step B: Pricing & Currency
const updateActionStepB = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { pricing, currency, taxProfileId } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (pricing) updateData.pricing = pricing;
    if (currency) updateData.currency = currency;
    if (taxProfileId !== undefined) updateData.taxProfileId = taxProfileId;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action pricing updated (Step B)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepB:", error);
    res.status(500).json({
      message: "An error occurred while updating pricing",
      error: error.message,
    });
  }
};

// Step C: Sub-actions
const createSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { name, description, price, stock, variants, metadata, sortOrder, coverImage, images } =
      req.body;

    if (!name || price === undefined) {
      res.status(400).json({
        message: "Name and price are required",
      });
      return;
    }

    // Fetch parent action for currency
    const parentAction = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!parentAction) {
      res.status(404).json({ message: "Parent action not found" });
      return;
    }

    // Handle cover image upload to Cloudinary
    let coverImageUrl: string | null = coverImage || null;

    // Check for file in req.file (when using .single()) or req.files (when using .fields())
    const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const coverFile = (req as any).file || uploadedFiles?.coverImage?.[0];
    const galleryFiles = uploadedFiles?.images ?? [];

    if (coverFile) {
      try {
        coverImageUrl = await uploadImageToCloudinary(coverFile, 'subactions/cover-images');
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    // Gallery images: already-hosted URLs from the body plus any freshly uploaded files
    let galleryImages = sanitizeImageUrls(images);
    if (galleryFiles.length > 0) {
      try {
        const uploadedGallery = await Promise.all(
          galleryFiles.map((file) => uploadImageToCloudinary(file, 'subactions/gallery'))
        );
        galleryImages = sanitizeImageUrls([...galleryImages, ...uploadedGallery]);
      } catch (uploadError: any) {
        console.error("Error uploading gallery images to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload gallery images to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    const subActionData: SubActionCreationAttributes = {
      actionId,
      name,
      description: description || null,
      price: parseFloat(price),
      stock: stock !== undefined && stock !== null ? parseInt(stock) : null,
      stockReserved: 0,
      variants: parseJsonField<Record<string, any>>(variants, {}),
      metadata: prepareSubActionMetadata(metadata),
      isActive: true,
      sortOrder: sortOrder !== undefined && sortOrder !== null ? parseInt(sortOrder) : 0,
      coverImage: coverImageUrl,
      images: galleryImages,
      dedicatedQrCodeData: null,
    };

    const newSubAction = await insert_function<SubActionModelAttributes>(
      "SubAction",
      "create",
      subActionData
    );

    // Create a dedicated wallet for this sub-action
    const subActionWallet = await insert_function("Wallet", "create", {
      subActionId: newSubAction.id,
      currency: (parentAction as any).currency || "RWF",
    } as any);

    // Generate QR code for the sub-action
    try {
      const subActionQrLink = `${process.env.FRONTEND_URL || 'https://app.quecode.ai'}/action/${actionId}/subactions/${newSubAction.id}`;
      const qrCodeData = await QRCode.toDataURL(subActionQrLink);
      
      // Update the sub-action with the generated QR code
      await insert_function<SubActionModelAttributes>(
        "SubAction",
        "update",
        { dedicatedQrCodeData: qrCodeData },
        { where: { id: newSubAction.id } }
      );

      // Fetch the updated sub-action to return
      const updatedSubAction = await read_function<SubActionModelAttributes>(
        "SubAction",
        "findOne",
        { where: { id: newSubAction.id } }
      );

      res.status(201).json({
        message: "Sub-action created successfully",
        data: {
          ...(updatedSubAction as any),
          wallet: {
            id: (subActionWallet as any).id,
            balance: (subActionWallet as any).balance,
            currency: (subActionWallet as any).currency,
          },
        },
      });
    } catch (qrError: any) {
      console.error("Error generating QR code for sub-action:", qrError);
      // Still return the sub-action even if QR code generation fails
      res.status(201).json({
        message: "Sub-action created successfully - QR code generation failed",
        data: {
          ...((newSubAction as any).toJSON ? (newSubAction as any).toJSON() : newSubAction),
          wallet: {
            id: (subActionWallet as any).id,
            balance: (subActionWallet as any).balance,
            currency: (subActionWallet as any).currency,
          },
        },
        qrError: qrError.message,
      });
    }
  } catch (error: any) {
    console.error("Error in createSubAction:", error);
    res.status(500).json({
      message: "An error occurred while creating sub-action",
      error: error.message,
    });
  }
};

// Step D: Duration & Availability
const updateActionStepD = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { availability } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    // Validate availability configuration
    let availabilityData = availability || {};
    
    // If scheduled mode is provided, validate dates
    if (availabilityData.mode === 'scheduled') {
      if (!availabilityData.startDate) {
        res.status(400).json({
          message: "Start date is required for scheduled availability",
        });
        return;
      }
      // endDate is optional - actions can run indefinitely from startDate
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { availability: availabilityData },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action availability updated (Step D)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepD:", error);
    res.status(500).json({
      message: "An error occurred while updating availability",
      error: error.message,
    });
  }
};

// Step E: Visibility & Access
const updateActionStepE = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { visibility, buyerFields } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (visibility) updateData.visibility = visibility;
    if (buyerFields) updateData.buyerFields = buyerFields;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action visibility updated (Step E)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepE:", error);
    res.status(500).json({
      message: "An error occurred while updating visibility",
      error: error.message,
    });
  }
};

// Step F: Rules & Conditions
const updateActionStepF = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { policy } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { policy: policy || {} },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action policy updated (Step F)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepF:", error);
    res.status(500).json({
      message: "An error occurred while updating policy",
      error: error.message,
    });
  }
};

// Step G: Fulfillment & Delivery
const updateActionStepG = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { fulfillment } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { fulfillment: fulfillment || { storeOnBuyerQR: false } },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action fulfillment updated (Step G)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepG:", error);
    res.status(500).json({
      message: "An error occurred while updating fulfillment",
      error: error.message,
    });
  }
};

// Step H: Advanced Personalization
const updateActionStepH = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { customFields, webhooks } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (customFields) updateData.customFields = customFields;
    if (webhooks) updateData.webhooks = webhooks;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action advanced settings updated (Step H)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepH:", error);
    res.status(500).json({
      message: "An error occurred while updating advanced settings",
      error: error.message,
    });
  }
};

// Step I: Publish
const publishAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { status } = req.body; // "published" or "draft"

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const validStatus = ["draft", "published", "archived"];
    const newStatus = status || "published";

    if (!validStatus.includes(newStatus)) {
      res.status(400).json({
        message: "Invalid status",
        validStatus,
      });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { status: newStatus },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: `Action ${newStatus} successfully`,
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in publishAction:", error);
    res.status(500).json({
      message: "An error occurred while publishing action",
      error: error.message,
    });
  }
};

// Get all actions for an organization
const getOrganizationActions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { status, type } = req.query;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (type) where.type = type;

    const actions = await read_function<ActionModelAttributes>(
      "Action",
      "findAll",
      {
        where,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: database_models.SubAction,
            as: "subActions",
            where: { isActive: true },
            required: false,
            include: [
              {
                model: database_models.Wallet,
                as: "wallet",
                attributes: ["id", "balance", "currency"],
              },
            ],
          },
        ],
      }
    );

    // Attach totalSubActionBalance to each action
    const enriched = (actions as unknown as any[]).map((action: any) => {
      const plain = action.toJSON ? action.toJSON() : action;
      const subActions: any[] = plain.subActions || [];
      const totalSubActionBalance = subActions.reduce(
        (sum: number, sa: any) => sum + parseFloat((sa.wallet?.balance ?? 0).toString()),
        0
      );
      return { ...plain, totalSubActionBalance };
    });

    res.status(200).json({
      message: "Actions retrieved successfully",
      data: enriched,
    });
  } catch (error: any) {
    console.error("Error in getOrganizationActions:", error);
    res.status(500).json({
      message: "An error occurred while retrieving actions",
      error: error.message,
    });
  }
};

// Get single action by ID
const getActionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    if (!actionId || actionId === 'undefined') {
      res.status(400).json({ message: "Valid action ID is required" });
      return;
    }

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: { id: actionId },
        include: [
          {
            model: database_models.SubAction,
            as: "subActions",
            where: { isActive: true },
            required: false,
            include: [
              {
                model: database_models.Wallet,
                as: "wallet",
                attributes: ["id", "balance", "currency"],
              },
            ],
          },
        ],
      }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const plain = (action as any).toJSON ? (action as any).toJSON() : action;
    const subActions: any[] = plain.subActions || [];
    const totalSubActionBalance = subActions.reduce(
      (sum: number, sa: any) => sum + parseFloat((sa.wallet?.balance ?? 0).toString()),
      0
    );

    res.status(200).json({
      message: "Action retrieved successfully",
      data: { ...plain, totalSubActionBalance },
    });
  } catch (error: any) {
    console.error("Error in getActionById:", error);
    res.status(500).json({
      message: "An error occurred while retrieving action",
      error: error.message,
    });
  }
};

// Get action by slug (public)
const getActionBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: {
          slug,
          status: "published",
        },
      }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found or not published" });
      return;
    }

    res.status(200).json({
      message: "Action retrieved successfully",
      data: action,
    });
  } catch (error: any) {
    console.error("Error in getActionBySlug:", error);
    res.status(500).json({
      message: "An error occurred while retrieving action",
      error: error.message,
    });
  }
};

// Update action
const updateAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { coverImage, metadata, ...otherFields } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = { ...otherFields };

    if (metadata !== undefined) {
      updateData.metadata = { ...((action as any).metadata || {}), ...metadata };
    }

    // Handle cover image upload to Cloudinary if file is provided
    // Check for file in req.file (when using .single()) or req.files (when using .fields())
    const coverFile = (req as any).file || (req.files as { [fieldname: string]: Express.Multer.File[] })?.coverImage?.[0];
    
    if (coverFile) {
      try {
        // Delete old cover image from Cloudinary if it exists
        if (action.coverImage && action.coverImage.includes('cloudinary')) {
          try {
            // Extract publicId from Cloudinary URL
            // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{publicId}.{ext}
            const urlMatch = action.coverImage.match(/\/upload\/(.+)$/);
            if (urlMatch && urlMatch[1]) {
              // Remove file extension to get publicId
              const publicId = urlMatch[1].replace(/\.[^/.]+$/, '');
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (deleteError) {
            console.warn("Could not delete old cover image:", deleteError);
            // Continue with upload even if deletion fails
          }
        }

        // Upload new cover image to Cloudinary
        let uploadResult: any;
        if ((coverFile as any).buffer && (coverFile as any).buffer.length > 0) {
          uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: 'actions/cover-images',
                transformation: [
                  { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
                  { quality: 'auto', format: 'auto' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end((coverFile as any).buffer);
          });
        } else if ((coverFile as any).path) {
          uploadResult = await cloudinary.uploader.upload((coverFile as any).path, {
            folder: 'actions/cover-images',
            transformation: [
              { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', format: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }

        updateData.coverImage = uploadResult.secure_url;
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    } else if (coverImage !== undefined && coverImage !== null && coverImage !== '') {
      // If coverImage is provided as a valid URL string (not file), use it directly
      // Only update if it's a non-empty string to preserve existing image when not changed
      updateData.coverImage = coverImage;
    }
    // If coverImage is undefined, null, or empty string, don't include it in updateData
    // This preserves the existing cover image in the database

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action updated successfully",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateAction:", error);
    res.status(500).json({
      message: "An error occurred while updating action",
      error: error.message,
    });
  }
};

// Delete action
const deleteAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    // Soft delete by archiving
    await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { status: "archived" },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action archived successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteAction:", error);
    res.status(500).json({
      message: "An error occurred while deleting action",
      error: error.message,
    });
  }
};

// Get sub-actions for an action
const getSubActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    const subActions = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findAll",
      {
        where: { actionId, isActive: true },
        order: [["sortOrder", "ASC"]],
        include: [
          {
            model: database_models.Wallet,
            as: "wallet",
            attributes: ["id", "balance", "currency"],
          },
        ],
      }
    );

    res.status(200).json({
      message: "Sub-actions retrieved successfully",
      data: Array.isArray(subActions)
        ? subActions.map(withNormalizedMetadata)
        : subActions,
    });
  } catch (error: any) {
    console.error("Error in getSubActions:", error);
    res.status(500).json({
      message: "An error occurred while retrieving sub-actions",
      error: error.message,
    });
  }
};

// Get single sub-action by ID
const getSubActionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subActionId } = req.params;

    const subAction = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findOne",
      {
        where: { id: subActionId },
        include: [
          {
            model: database_models.Wallet,
            as: "wallet",
            attributes: ["id", "balance", "currency"],
          },
        ],
      }
    );

    if (!subAction) {
      res.status(404).json({ message: "Sub-action not found" });
      return;
    }

    // Fetch parent action to get the type
    const parentAction = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: (subAction as any).actionId } }
    );

    // Convert Sequelize instance to plain object
    const subActionData = withNormalizedMetadata(subAction);

    res.status(200).json({
      message: "Sub-action retrieved successfully",
      data: {
        ...subActionData,
        parentActionType: parentAction?.type || null,
      },
    });
  } catch (error: any) {
    console.error("Error in getSubActionById:", error);
    res.status(500).json({
      message: "An error occurred while retrieving sub-action",
      error: error.message,
    });
  }
};

// Update sub-action
const updateSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subActionId } = req.params;
    const { metadata, images, variants, ...otherFields } = req.body;

    const existing = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findOne",
      { where: { id: subActionId } }
    );
    if (!existing) {
      res.status(404).json({ message: "Sub-action not found" });
      return;
    }

    const updateData: any = { ...otherFields };

    if (metadata !== undefined) {
      // Older rows may hold a stringified metadata blob, so normalize before merging
      const existingMetadata = normalizeMetadata((existing as any).metadata);
      updateData.metadata = {
        ...existingMetadata,
        ...prepareSubActionMetadata(metadata),
      };
    }

    if (variants !== undefined) {
      updateData.variants = parseJsonField<Record<string, any>>(variants, {});
    }

    const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const coverFile = (req as any).file || uploadedFiles?.coverImage?.[0];
    const galleryFiles = uploadedFiles?.images ?? [];

    if (coverFile) {
      try {
        updateData.coverImage = await uploadImageToCloudinary(
          coverFile,
          "subactions/cover-images"
        );
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    // `images` in the body is the full list of existing URLs to keep; uploads are appended
    if (images !== undefined || galleryFiles.length > 0) {
      let galleryImages =
        images !== undefined
          ? sanitizeImageUrls(images)
          : sanitizeImageUrls((existing as any).images);

      if (galleryFiles.length > 0) {
        try {
          const uploadedGallery = await Promise.all(
            galleryFiles.map((file) =>
              uploadImageToCloudinary(file, "subactions/gallery")
            )
          );
          galleryImages = sanitizeImageUrls([...galleryImages, ...uploadedGallery]);
        } catch (uploadError: any) {
          console.error("Error uploading gallery images to Cloudinary:", uploadError);
          res.status(500).json({
            message: "Failed to upload gallery images to Cloudinary",
            error: uploadError.message,
          });
          return;
        }
      }

      updateData.images = galleryImages;
    }

    await insert_function<SubActionModelAttributes>(
      "SubAction",
      "update",
      updateData,
      { where: { id: subActionId } }
    );

    const updatedSubAction = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findOne",
      { where: { id: subActionId } }
    );

    res.status(200).json({
      message: "Sub-action updated successfully",
      data: updatedSubAction,
    });
  } catch (error: any) {
    console.error("Error in updateSubAction:", error);
    res.status(500).json({
      message: "An error occurred while updating sub-action",
      error: error.message,
    });
  }
};

// Delete sub-action
const deleteSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subActionId } = req.params;

    // Soft delete by deactivating
    await insert_function<SubActionModelAttributes>(
      "SubAction",
      "update",
      { isActive: false },
      { where: { id: subActionId } }
    );

    res.status(200).json({
      message: "Sub-action deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteSubAction:", error);
    res.status(500).json({
      message: "An error occurred while deleting sub-action",
      error: error.message,
    });
  }
};

export default {
  createActionStepA,
  updateActionStepB,
  createSubAction,
  updateActionStepD,
  updateActionStepE,
  updateActionStepF,
  updateActionStepG,
  updateActionStepH,
  publishAction,
  getOrganizationActions,
  getActionById,
  getActionBySlug,
  updateAction,
  deleteAction,
  getSubActions,
  getSubActionById,
  updateSubAction,
  deleteSubAction,
};

