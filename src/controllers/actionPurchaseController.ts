import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ActionPurchaseCreationAttributes,
  ActionPurchaseModelAttributes,
  QRObjectCreationAttributes,
  QRObjectModelAttributes,
  ActionModelAttributes,
  SubActionModelAttributes,
} from "../types/model";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

const { Wallet, Transaction: TransactionModel } = database_models;

// Purchase an action (integrated with transaction system)
const purchaseAction = async (req: Request, res: Response): Promise<void> => {
  const dbTransaction = await TransactionModel.sequelize?.transaction();

  try {
    const { actionId } = req.params;
    const { subActionId, quantity = 1, buyerData, amount } = req.body;

    // Get buyer ID from authenticated user (assuming middleware sets req.user)
    const buyerId = (req as any).user?.id || req.body.buyerId;

    if (!buyerId) {
      await dbTransaction?.rollback();
      res.status(401).json({
        success: false,
        message: "Buyer ID is required",
      });
      return;
    }

    // 1. Validate action exists and is published
    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: { id: actionId, status: "published" },
      }
    );

    if (!action) {
      await dbTransaction?.rollback();
      res.status(404).json({
        success: false,
        message: "Action not found or not published",
      });
      return;
    }

    // 2. Get sub-action if provided
    let subAction: SubActionModelAttributes | null = null;
    let unitPrice = 0;

    if (subActionId) {
      subAction = await read_function<SubActionModelAttributes>(
        "SubAction",
        "findOne",
        {
          where: { id: subActionId, actionId, isActive: true },
        }
      );

      if (!subAction) {
        await dbTransaction?.rollback();
        res.status(404).json({
          success: false,
          message: "Sub-action not found or inactive",
        });
        return;
      }

      // Check if custom amount is provided (pay-what-you-want), otherwise use default price
      if (amount !== undefined && amount !== null) {
        unitPrice = parseFloat(amount.toString());
      } else {
        unitPrice = parseFloat(subAction.price.toString());
      }

      // Check stock availability (only if stock is limited, not unlimited/null)
      if (subAction.stock !== null && subAction.stock !== undefined) {
        const availableStock =
          subAction.stock - (subAction.stockReserved || 0);
        if (availableStock < quantity) {
          await dbTransaction?.rollback();
          res.status(400).json({
            success: false,
            message: "Insufficient stock",
            available: availableStock,
            requested: quantity,
          });
          return;
        }
      }
    } else {
      // No sub-action, use action pricing or custom amount if provided
      if (amount !== undefined && amount !== null) {
        // Pay-what-you-want pricing with custom amount
        unitPrice = parseFloat(amount.toString());
      } else if (action.pricing.mode === "fixed") {
        unitPrice = action.pricing.amount || 0;
      } else if (action.pricing.mode === "free") {
        unitPrice = 0;
      } else {
        await dbTransaction?.rollback();
        res.status(400).json({
          success: false,
          message: "Action requires sub-action selection or amount in request body",
        });
        return;
      }
    }

    // 3. Check availability (dates, user quota, etc.)
    const now = new Date();
    
    // Check sales window (when sales are allowed)
    if (action.availability.salesWindow) {
      // Check if sales have started (if salesWindow.from exists)
      if (action.availability.salesWindow.from) {
        const salesStart = new Date(action.availability.salesWindow.from);
        if (now < salesStart) {
          await dbTransaction?.rollback();
          res.status(400).json({
            success: false,
            message: "Sales have not started yet",
            salesStart: action.availability.salesWindow.from,
          });
          return;
        }
      }
      
      // Check if sales have ended (if salesWindow.until exists)
      if (action.availability.salesWindow.until) {
        const salesEnd = new Date(action.availability.salesWindow.until);
        if (now > salesEnd) {
          await dbTransaction?.rollback();
          res.status(400).json({
            success: false,
            message: "Sales have ended",
            salesEnd: action.availability.salesWindow.until,
          });
          return;
        }
      }
    }
    
    // Check if event has already passed (optional check)
    if (action.availability.endsAt) {
      const eventEnd = new Date(action.availability.endsAt);
      if (now > eventEnd) {
        await dbTransaction?.rollback();
        res.status(400).json({
          success: false,
          message: "This event has already passed",
          eventEnd: action.availability.endsAt,
        });
        return;
      }
    }

    // Check user quota
    if (action.availability.userQuota) {
      const userPurchases = await read_function<ActionPurchaseModelAttributes[]>(
        "ActionPurchase",
        "findAll",
        {
          where: {
            buyerId,
            actionId,
            status: "completed",
          },
        }
      );

      const totalPurchased = (userPurchases || []).reduce(
        (sum: number, p: ActionPurchaseModelAttributes) => sum + p.quantity,
        0
      );

      if (totalPurchased + quantity > action.availability.userQuota) {
        await dbTransaction?.rollback();
        res.status(400).json({
          success: false,
          message: "User quota exceeded",
          quota: action.availability.userQuota,
          purchased: totalPurchased,
          requested: quantity,
        });
        return;
      }
    }

    // 4. Calculate total amount
    const totalAmount = unitPrice * quantity;

    // 5. Get wallets
    const buyerWallet = await Wallet.findOne({
      where: { userId: buyerId, isActive: true },
      lock: dbTransaction?.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!buyerWallet) {
      await dbTransaction?.rollback();
      res.status(404).json({
        success: false,
        message: "Buyer wallet not found",
      });
      return;
    }

    // Determine receiver wallet: sub-action wallet when subActionId is given, else org wallet
    let receiverWallet: any = null;
    if (subActionId) {
      receiverWallet = await Wallet.findOne({
        where: { subActionId, isActive: true },
        lock: dbTransaction?.LOCK.UPDATE,
        transaction: dbTransaction,
      });
      if (!receiverWallet) {
        await dbTransaction?.rollback();
        res.status(404).json({
          success: false,
          message: "Sub-action wallet not found. Ensure the sub-action was created correctly.",
        });
        return;
      }
    } else {
      receiverWallet = await Wallet.findOne({
        where: { organizationId: action.organizationId, isActive: true },
        lock: dbTransaction?.LOCK.UPDATE,
        transaction: dbTransaction,
      });
      if (!receiverWallet) {
        await dbTransaction?.rollback();
        res.status(404).json({
          success: false,
          message: "Organization wallet not found",
        });
        return;
      }
    }

    // 6. Check balance (if not free)
    if (totalAmount > 0 && parseFloat(buyerWallet.balance.toString()) < totalAmount) {
      await dbTransaction?.rollback();
      res.status(400).json({
        success: false,
        message: "Insufficient balance",
        balance: buyerWallet.balance,
        required: totalAmount,
      });
      return;
    }

    // 7. Reserve stock (if sub-action has limited stock)
    if (subAction && subAction.stock !== null && subAction.stock !== undefined) {
      await insert_function<SubActionModelAttributes>(
        "SubAction",
        "update",
        {
          stockReserved: (subAction.stockReserved || 0) + quantity,
        },
        {
          where: { id: subActionId },
          transaction: dbTransaction,
        }
      );
    }

    // 8. Create transaction (reuse existing transaction logic)
    const referenceId = `ACT-${uuidv4().substring(0, 8).toUpperCase()}`;

    let transaction: any = null;
    if (totalAmount > 0) {
      // Update wallets
      await buyerWallet.update(
        {
          balance: parseFloat(buyerWallet.balance.toString()) - totalAmount,
        },
        { transaction: dbTransaction }
      );

      await receiverWallet.update(
        {
          balance: parseFloat(receiverWallet.balance.toString()) + totalAmount,
        },
        { transaction: dbTransaction }
      );

      // Create transaction record
      transaction = await TransactionModel.create(
        {
          referenceId,
          senderWalletId: buyerWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: totalAmount,
          fee: 0,
          totalAmount: totalAmount,
          currency: action.currency,
          status: "completed",
          type: "payment",
          description: `${action.name}${subAction ? ` - ${subAction.name}` : ""} x${quantity}`,
          actionId: action.id,
          subActionId: subActionId || null,
        } as any,
        { transaction: dbTransaction }
      );
    } else {
      // Free action - create transaction with 0 amount
      transaction = await TransactionModel.create(
        {
          referenceId,
          senderWalletId: buyerWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: 0,
          fee: 0,
          totalAmount: 0,
          currency: action.currency,
          status: "completed",
          type: action.type === "donation" ? "donation" : "payment",
          description: `${action.name}${subAction ? ` - ${subAction.name}` : ""} x${quantity}`,
          actionId: action.id,
          subActionId: subActionId || null,
        } as any,
        { transaction: dbTransaction }
      );
    }

    // 9. Create action purchase
    const purchaseData: ActionPurchaseCreationAttributes = {
      actionId: action.id,
      subActionId: subActionId || null,
      buyerId,
      organizationId: action.organizationId,
      transactionId: transaction.id,
      quantity,
      unitPrice,
      totalAmount,
      currency: action.currency,
      buyerData: buyerData || {},
      status: "completed",
      qrObjectId: null, // Will be set after QR object creation
    };

    const actionPurchase = await insert_function<ActionPurchaseModelAttributes>(
      "ActionPurchase",
      "create",
      purchaseData,
      { transaction: dbTransaction }
    );

    // 10. Update transaction with actionPurchaseId
    await transaction.update(
      { actionPurchaseId: actionPurchase.id },
      { transaction: dbTransaction }
    );

    // 11. Decrement stock (if sub-action has limited stock)
    if (subAction && subAction.stock !== null && subAction.stock !== undefined) {
      await insert_function<SubActionModelAttributes>(
        "SubAction",
        "update",
        {
          stock: subAction.stock - quantity,
          stockReserved: (subAction.stockReserved || 0) - quantity,
        },
        {
          where: { id: subActionId },
          transaction: dbTransaction,
        }
      );
    }

    // 12. Create QR Object if fulfillment requires it
    let qrObject: any = null;
    if (action.fulfillment.storeOnBuyerQR) {
      const qrObjectType = action.fulfillment.objectType || "eticket";
      
      // Generate QR code data
      const qrData = {
        type: qrObjectType,
        actionId: action.id,
        actionPurchaseId: actionPurchase.id,
        buyerId,
        issuedAt: new Date().toISOString(),
        metadata: {
          actionName: action.name,
          subActionName: subAction?.name,
          quantity,
          ...(subAction?.metadata || {}),
        },
      };

      const qrCodeUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/qr/${actionPurchase.id}`;
      const qrCodeData = await QRCode.toDataURL(qrCodeUrl);

      const qrObjectData: QRObjectCreationAttributes = {
        buyerId,
        actionId: action.id,
        actionPurchaseId: actionPurchase.id,
        subActionId: subActionId || null,
        type: qrObjectType as any,
        metadata: qrData.metadata,
        status: "valid",
        validUntil: action.availability.endsAt
          ? new Date(action.availability.endsAt)
          : null,
        usedAt: null,
        qrCodeData,
        coverImage: action.coverImage || null,
      };

      qrObject = await insert_function<QRObjectModelAttributes>(
        "QRObject",
        "create",
        qrObjectData,
        { transaction: dbTransaction }
      );

      // Update action purchase with qrObjectId
      await insert_function<ActionPurchaseModelAttributes>(
        "ActionPurchase",
        "update",
        { qrObjectId: qrObject.id },
        {
          where: { id: actionPurchase.id },
          transaction: dbTransaction,
        }
      );
    }

    // Commit transaction
    await dbTransaction?.commit();

    res.status(201).json({
      success: true,
      message: "Action purchased successfully",
      data: {
        actionPurchase,
        transaction: {
          id: transaction.id,
          referenceId: transaction.referenceId,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          type: transaction.type,
          description: transaction.description,
        },
        wallets: {
          buyer: {
            id: buyerWallet.id,
            balanceAfter: parseFloat(buyerWallet.balance.toString()),
            currency: buyerWallet.currency,
          },
          receiver: {
            id: receiverWallet.id,
            balanceAfter: parseFloat(receiverWallet.balance.toString()),
            currency: receiverWallet.currency,
            type: subActionId ? "subAction" : "organization",
          },
        },
        qrObject: qrObject
          ? {
              id: qrObject.id,
              qrCodeData: qrObject.qrCodeData,
              type: qrObject.type,
            }
          : null,
      },
    });
  } catch (error: any) {
    await dbTransaction?.rollback();
    console.error("Error in purchaseAction:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while purchasing action",
      error: error.message,
    });
  }
};

// Get user's QR objects
const getUserQRObjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, type } = req.query;

    const where: any = { buyerId: userId };
    if (status) where.status = status;
    if (type) where.type = type;

    const qrObjects = await read_function<QRObjectModelAttributes>(
      "QRObject",
      "findAll",
      {
        where,
        order: [["issuedAt", "DESC"]],
      }
    );

    res.status(200).json({
      success: true,
      message: "QR objects retrieved successfully",
      data: qrObjects,
    });
  } catch (error: any) {
    console.error("Error in getUserQRObjects:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving QR objects",
      error: error.message,
    });
  }
};

// Get user's action purchases
const getUserPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const where: any = { buyerId: userId };
    if (status) where.status = status;

    const purchases = await read_function<ActionPurchaseModelAttributes>(
      "ActionPurchase",
      "findAll",
      {
        where,
        order: [["createdAt", "DESC"]],
      }
    );

    res.status(200).json({
      success: true,
      message: "Purchases retrieved successfully",
      data: purchases,
    });
  } catch (error: any) {
    console.error("Error in getUserPurchases:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving purchases",
      error: error.message,
    });
  }
};

// Validate/Scan QR object
const validateQRObject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrObjectId } = req.params;

    // First, try to find QR object by ID (qrObjectId)
    let qrObject: any = await read_function<QRObjectModelAttributes>(
      "QRObject",
      "findOne",
      {
        where: { id: qrObjectId },
        include: [
          {
            model: database_models.User,
            as: "buyer",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: database_models.ActionPurchase,
            as: "actionPurchase",
            attributes: ["id", "buyerData"],
          },
        ],
      }
    );

    // If not found by ID, try to find by actionPurchaseId
    // (QR code contains actionPurchaseId, so we need to look it up)
    if (!qrObject) {
      qrObject = await read_function<QRObjectModelAttributes>(
        "QRObject",
        "findOne",
        {
          where: { actionPurchaseId: qrObjectId },
          include: [
            {
              model: database_models.User,
              as: "buyer",
              attributes: ["id", "firstName", "lastName", "email"],
            },
            {
              model: database_models.ActionPurchase,
              as: "actionPurchase",
              attributes: ["id", "buyerData"],
            },
          ],
        }
      );
    }

    if (!qrObject) {
      res.status(404).json({
        success: false,
        message: "QR object not found",
      });
      return;
    }

    // Check if valid
    if (qrObject.status !== "valid") {
      res.status(400).json({
        success: false,
        message: `QR object is ${qrObject.status}`,
        status: qrObject.status,
      });
      return;
    }

    // Check expiration
    if (qrObject.validUntil && new Date() > new Date(qrObject.validUntil)) {
      // Update status to expired
      await insert_function<QRObjectModelAttributes>(
        "QRObject",
        "update",
        { status: "expired" },
        { where: { id: qrObject.id } }
      );

      res.status(400).json({
        success: false,
        message: "QR object has expired",
        validUntil: qrObject.validUntil,
      });
      return;
    }

    // Convert to plain object if it's a Sequelize instance
    const qrObjectPlain: any = qrObject.get ? qrObject.get({ plain: true }) : qrObject;

    // Format response with buyer information
    const responseData: any = {
      ...qrObjectPlain,
    };

    // Add buyer/owner name from multiple sources
    if (qrObjectPlain.buyer) {
      const buyer = qrObjectPlain.buyer.get ? qrObjectPlain.buyer.get({ plain: true }) : qrObjectPlain.buyer;
      const fullName = `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim();
      if (fullName) {
        responseData.buyer = {
          ...buyer,
          fullName,
          name: fullName,
        };
      }
    }

    // Also check buyerData from actionPurchase
    if (qrObjectPlain.actionPurchase?.buyerData) {
      const actionPurchase = qrObjectPlain.actionPurchase.get 
        ? qrObjectPlain.actionPurchase.get({ plain: true }) 
        : qrObjectPlain.actionPurchase;
      const buyerData = actionPurchase.buyerData;
      if (buyerData && (buyerData.name || buyerData.ownerName || buyerData.fullName)) {
        if (!responseData.metadata) {
          responseData.metadata = { ...qrObjectPlain.metadata };
        }
        responseData.metadata.buyerName = buyerData.name || buyerData.ownerName || buyerData.fullName;
        responseData.metadata.ownerName = buyerData.name || buyerData.ownerName || buyerData.fullName;
      }
    }

    res.status(200).json({
      success: true,
      message: "QR object is valid",
      data: responseData,
    });
  } catch (error: any) {
    console.error("Error in validateQRObject:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while validating QR object",
      error: error.message,
    });
  }
};

// Mark QR object as used
const useQRObject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrObjectId } = req.params;

    // First, try to find QR object by ID (qrObjectId)
    let qrObject = await read_function<QRObjectModelAttributes>(
      "QRObject",
      "findOne",
      {
        where: { id: qrObjectId },
      }
    );

    // If not found by ID, try to find by actionPurchaseId
    // (QR code contains actionPurchaseId, so we need to look it up)
    if (!qrObject) {
      qrObject = await read_function<QRObjectModelAttributes>(
        "QRObject",
        "findOne",
        {
          where: { actionPurchaseId: qrObjectId },
        }
      );
    }

    if (!qrObject) {
      res.status(404).json({
        success: false,
        message: "QR object not found",
      });
      return;
    }

    if (qrObject.status !== "valid") {
      res.status(400).json({
        success: false,
        message: `Cannot use QR object with status: ${qrObject.status}`,
      });
      return;
    }

    await insert_function<QRObjectModelAttributes>(
      "QRObject",
      "update",
      {
        status: "used",
        usedAt: new Date(),
      },
      { where: { id: qrObject.id } }
    );

    res.status(200).json({
      success: true,
      message: "QR object marked as used",
    });
  } catch (error: any) {
    console.error("Error in useQRObject:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while using QR object",
      error: error.message,
    });
  }
};

export default {
  purchaseAction,
  getUserQRObjects,
  getUserPurchases,
  validateQRObject,
  useQRObject,
};

