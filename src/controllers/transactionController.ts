import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { Op, fn, col } from "sequelize";
import * as bcrypt from "bcrypt";
import database_models from "../database/config/db.config";
import Models from "../database/models";

const {
  Wallet,
  Transaction: TransactionModel,
  Category,
  WalletRestriction,
  User,
  Organization,
} = database_models;

// Helper function to calculate fee
const calculateFee = (amount: number): number => {
  const feePercentage = 0.02;
  const fee = amount * feePercentage;
  const minFee = 5;
  const maxFee = 1000;

  return Math.min(Math.max(fee, minFee), maxFee);
};

// Transfer money between users and/or organizations
const transferMoney = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const transaction = await TransactionModel.sequelize?.transaction();

  try {
    const {
      senderUserId,
      senderOrganizationId,
      receiverUserId,
      receiverOrganizationId,
      amount,
      description = "",
      categoryId,
      type = "transfer",
      applyConstraints = false, // New parameter to control constraint application
      pin, // PIN for verification
    } = req.body;

    // Validation - must have either user or organization for sender and receiver
    const hasSender = senderUserId || senderOrganizationId;
    const hasReceiver = receiverUserId || receiverOrganizationId;

    if (!hasSender || !hasReceiver || !amount) {
      res.status(400).json({
        success: false,
        message:
          "Sender (user or organization), receiver (user or organization), and amount are required",
      });
      return;
    }

    // Cannot send to self
    if (
      (senderUserId && receiverUserId && senderUserId === receiverUserId) ||
      (senderOrganizationId &&
        receiverOrganizationId &&
        senderOrganizationId === receiverOrganizationId)
    ) {
      res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself",
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
      return;
    }

    // SECURITY FIX: Authenticated user must be the sender
    const authenticatedUserId = req.user.id;

    // For user-to-user transfers, authenticated user must be the sender
    if (senderUserId && senderUserId !== authenticatedUserId) {
      res.status(403).json({
        success: false,
        message: "You can only send money from your own account",
      });
      return;
    }

    // For organization transfers, we need to check if user is authorized for that organization
    // TODO: Add organization authorization check

    // PIN check for authenticated user senders (organizations don't require PIN)
    if (senderUserId) {
      const authenticatedUser = await User.findByPk(authenticatedUserId);
      if (!authenticatedUser) {
        res.status(404).json({
          success: false,
          message: "Authenticated user not found",
        });
        return;
      }

      if (!authenticatedUser.hasPinSet) {
        res.status(403).json({
          success: false,
          message:
            "PIN not set up. Please set up your transaction PIN before making transfers.",
          requiresPinSetup: true,
        });
        return;
      }
    }

    // PIN verification for authenticated user senders
    if (senderUserId) {
      if (!pin) {
        res.status(400).json({
          success: false,
          message: "PIN is required for transactions",
        });
        return;
      }

      // Validate PIN format
      if (!/^\d{4}$/.test(pin)) {
        res.status(400).json({
          success: false,
          message: "PIN must be exactly 4 digits",
        });
        return;
      }

      // Get the authenticated user (we already verified they exist and have PIN set)
      const authenticatedUser = await User.findByPk(authenticatedUserId);

      // Check if user is currently locked out
      if (
        authenticatedUser!.pinLockedUntil &&
        authenticatedUser!.pinLockedUntil > new Date()
      ) {
        const remainingTime = Math.ceil(
          (authenticatedUser!.pinLockedUntil.getTime() - Date.now()) / 60000,
        );
        res.status(429).json({
          success: false,
          message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
          lockedUntil: authenticatedUser!.pinLockedUntil,
          remainingMinutes: remainingTime,
        });
        return;
      }

      // Verify PIN for authenticated user
      const isValidPin = await bcrypt.compare(
        pin,
        authenticatedUser!.transactionPin!,
      );

      if (!isValidPin) {
        // Failed verification - increment attempts
        const newAttempts = (authenticatedUser!.pinAttempts || 0) + 1;
        const maxAttempts = 3;
        const lockoutMinutes = 15;

        let updateData: any = { pinAttempts: newAttempts };

        // Check if max attempts reached
        if (newAttempts >= maxAttempts) {
          const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
          updateData.pinLockedUntil = lockedUntil;

          await authenticatedUser!.update(updateData);

          // Send account blocked email notification
          try {
            const sendEmailFn = require("../helpers/email").default;
            await sendEmailFn({
              to: authenticatedUser!.email,
              subject: "Account Locked - PIN Reset Required",
              type: "account_blocked",
              data: {
                name: authenticatedUser!.firstName,
                lockoutMinutes: lockoutMinutes.toString(),
                resetUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/security?tab=pin-reset`,
              },
            });
          } catch (emailError) {
            console.error("Failed to send account blocked email:", emailError);
          }

          res.status(429).json({
            success: false,
            message: `Account locked due to too many failed PIN attempts. Please reset your PIN to regain access.`,
            attemptsRemaining: 0,
            lockedUntil: lockedUntil,
            remainingMinutes: lockoutMinutes,
          });
        } else {
          await authenticatedUser!.update(updateData);

          const attemptsRemaining = maxAttempts - newAttempts;
          res.status(400).json({
            success: false,
            message: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
            attemptsRemaining: attemptsRemaining,
          });
        }
        return;
      } else {
        // Successful verification - reset attempts and clear lockout
        await authenticatedUser!.update({
          pinAttempts: 0,
          pinLockedUntil: null,
        });
      }
    }

    // Check for duplicate transactions in the last 30 seconds
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);

    // Build wallet search conditions for sender and receiver
    const senderWhere = senderUserId
      ? { userId: senderUserId, isActive: true }
      : { organizationId: senderOrganizationId, isActive: true };

    const receiverWhere = receiverUserId
      ? { userId: receiverUserId, isActive: true }
      : { organizationId: receiverOrganizationId, isActive: true };

    // First find the wallets to get their IDs
    const [checkSenderWallet, checkReceiverWallet] = await Promise.all([
      Wallet.findOne({ where: senderWhere }),
      Wallet.findOne({ where: receiverWhere }),
    ]);

    if (checkSenderWallet && checkReceiverWallet) {
      const recentTransaction = await TransactionModel.findOne({
        where: {
          senderWalletId: checkSenderWallet.id,
          receiverWalletId: checkReceiverWallet.id,
          amount: parseFloat(amount),
          createdAt: {
            [Op.gte]: thirtySecondsAgo,
          },
          status: "completed",
        },
        order: [["createdAt", "DESC"]],
      });

      if (recentTransaction) {
        await transaction?.rollback();
        res.status(400).json({
          success: false,
          message:
            "Duplicate transaction detected. Please wait before making another similar transfer.",
        });
        return;
      }
    }

    // Calculate fee and total amount
    const transferAmount = parseFloat(amount);
    //const fee = calculateFee(transferAmount);
    //fee not needed for now
    const fee = 0;
    const totalAmount = transferAmount + fee;

    // Find wallets for both sender and receiver (users or organizations)
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({
        where: senderWhere,
        lock: transaction?.LOCK.UPDATE,
        transaction,
      }),
      Wallet.findOne({
        where: receiverWhere,
        lock: transaction?.LOCK.UPDATE,
        transaction,
      }),
    ]);

    // Check if wallets exist
    if (!senderWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: "Sender wallet not found or inactive",
      });
      return;
    }

    if (!receiverWallet) {
      await transaction?.rollback();
      res.status(404).json({
        success: false,
        message: "Receiver wallet not found or inactive",
      });
      return;
    }

    // Check sufficient balance
    if (senderWallet.balance < totalAmount) {
      await transaction?.rollback();
      res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
      return;
    }

    // Check wallet restrictions and calculate available amounts
    const restrictions = await WalletRestriction.findAll({
      where: { walletId: senderWallet.id },
      include: [
        {
          model: Category,
          as: "category",
          required: true,
        },
      ],
      transaction,
    });

    // Calculate total restricted amount
    const totalRestrictedAmount = restrictions.reduce(
      (sum, restriction) => sum + parseFloat(restriction.amount.toString()),
      0,
    );

    // Calculate available unrestricted amount
    const totalBalance = parseFloat(senderWallet.balance.toString());
    // Prevent negative unrestricted amount when restrictions exceed total balance
    const availableUnrestrictedAmount = Math.max(
      0,
      totalBalance - totalRestrictedAmount,
    );

    // Rule: When sending to an individual user, only unrestricted funds can be used
    if (receiverUserId) {
      if (availableUnrestrictedAmount < transferAmount) {
        await transaction?.rollback();
        res.status(400).json({
          success: false,
          message: `Insufficient unrestricted balance for transfer to a user. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
          availableUnrestrictedAmount,
          requiredAmount: transferAmount,
        });
        return;
      }
      // If spending on a specific category, check constraints
    } else if (categoryId) {
      const matchingRestriction = restrictions.find(
        (restriction) => restriction.categoryId === categoryId,
      );

      if (matchingRestriction) {
        // Allow mixing: use restricted up to available, then top-up from unrestricted
        const restrictedAvailable = parseFloat(
          matchingRestriction.amount.toString(),
        );
        if (restrictedAvailable < transferAmount) {
          const remainderNeededFromUnrestricted =
            transferAmount - restrictedAvailable;
          if (availableUnrestrictedAmount < remainderNeededFromUnrestricted) {
            await transaction?.rollback();
            res.status(400).json({
              success: false,
              message: `Insufficient funds. Restricted available: ${restrictedAvailable}, Unrestricted available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
              restrictedAvailable,
              unrestrictedAvailable: availableUnrestrictedAmount,
              requiredAmount: transferAmount,
            });
            return;
          }
        }
      } else {
        // Spending on a different category - check if enough unrestricted funds
        if (availableUnrestrictedAmount < transferAmount) {
          await transaction?.rollback();
          const allowedCategories = restrictions
            .map((r) => (r as any).category?.name)
            .join(", ");
          res.status(400).json({
            success: false,
            message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}. You can spend restricted funds on: ${allowedCategories}`,
            availableUnrestrictedAmount,
            requiredAmount: transferAmount,
            allowedCategories: restrictions.map((r) => ({
              categoryId: r.categoryId,
              categoryName: (r as any).category?.name,
              availableAmount: parseFloat(r.amount.toString()),
            })),
          });
          return;
        }
      }
    } else {
      // No category specified - check if enough unrestricted funds
      if (availableUnrestrictedAmount < transferAmount) {
        await transaction?.rollback();
        const allowedCategories = restrictions
          .map((r) => (r as any).category?.name)
          .join(", ");
        res.status(400).json({
          success: false,
          message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}. You can spend restricted funds on: ${allowedCategories}`,
          availableUnrestrictedAmount,
          requiredAmount: transferAmount,
          allowedCategories: restrictions.map((r) => ({
            categoryId: r.categoryId,
            categoryName: (r as any).category?.name,
            availableAmount: parseFloat(r.amount.toString()),
          })),
        });
        return;
      }
    }

    // Verify category if provided
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        await transaction?.rollback();
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }
    }

    // Generate reference ID
    const referenceId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Store original balances before updates for response
    const originalSenderBalance = parseFloat(senderWallet.balance.toString());
    const originalReceiverBalance = parseFloat(
      receiverWallet.balance.toString(),
    );

    // Update wallet balances
    await senderWallet.update(
      {
        balance: originalSenderBalance - totalAmount,
      },
      { transaction },
    );

    const hey = await receiverWallet.update(
      {
        balance: originalReceiverBalance + transferAmount,
      },
      { transaction },
    );

    // Refresh the wallet instances to get updated values
    await senderWallet.reload({ transaction });
    await receiverWallet.reload({ transaction });

    // Determine constraint type
    const spendConstraintType =
      applyConstraints && categoryId ? "category" : "none";
    const constraintCategoryId =
      applyConstraints && categoryId ? categoryId : null;

    // Create transaction record
    const newTransaction = await TransactionModel.create(
      {
        referenceId,
        senderWalletId: senderWallet.id,
        receiverWalletId: receiverWallet.id,
        amount: transferAmount,
        fee,
        totalAmount,
        currency: senderWallet.currency,
        status: "completed",
        type,
        description,
        categoryId,
        spendConstraintType,
        constraintCategoryId,
        hasAccount: true,
      } as any,
      { transaction },
    );

    // Create wallet restriction if constraints are applied
    if (applyConstraints && categoryId) {
      // Check if restriction already exists for this wallet and category
      const existingRestriction = await WalletRestriction.findOne({
        where: {
          walletId: receiverWallet.id,
          categoryId: categoryId,
        },
        transaction,
      });

      if (existingRestriction) {
        // Update existing restriction amount
        await existingRestriction.update(
          {
            amount:
              parseFloat(existingRestriction.amount.toString()) +
              transferAmount,
          },
          { transaction },
        );
      } else {
        // Create new restriction
        await WalletRestriction.create(
          {
            walletId: receiverWallet.id,
            categoryId: categoryId,
            amount: transferAmount,
          },
          { transaction },
        );
      }
    }

    // Update wallet restrictions for sender based on spending source
    // Do NOT reduce restricted funds when sending to a user (unrestricted-only rule)
    if (categoryId && !receiverUserId) {
      const matchingRestriction = restrictions.find(
        (restriction) => restriction.categoryId === categoryId,
      );

      if (matchingRestriction) {
        // Reduce restriction only up to available restricted funds; remainder comes from unrestricted
        const restrictedAvailable = parseFloat(
          matchingRestriction.amount.toString(),
        );
        const reduceBy = Math.min(restrictedAvailable, transferAmount);
        const newAmount = restrictedAvailable - reduceBy;
        if (newAmount <= 0) {
          // Remove restriction if amount is zero or negative
          await matchingRestriction.destroy({ transaction });
        } else {
          // Update restriction amount
          await matchingRestriction.update(
            { amount: newAmount },
            { transaction },
          );
        }
      }
      // If no matching restriction, we're spending from unrestricted funds - no restriction updates needed
    } else {
      // No category specified - spending from unrestricted funds - no restriction updates needed
    }

    // Commit the transaction
    await transaction?.commit();

    // Return success response
    res.status(200).json({
      success: true,
      message: "Transfer completed successfully",
      data: {
        transactionId: newTransaction.id,
        referenceId: newTransaction.referenceId,
        amount: transferAmount,
        fee,
        totalAmount,
        senderBalance: senderWallet.balance,
        senderUserId: senderUserId || null,
        senderOrganizationId: senderOrganizationId || null,
        receiverUserId: receiverUserId || null,
        receiverOrganizationId: receiverOrganizationId || null,
        description,
        categoryId,
        spendConstraintType,
        constraintCategoryId,
        constraintsApplied: applyConstraints,
        status: "completed",
      },
    });
  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
    }

    console.error("Transfer error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during transfer",
    });
  }
};

// Get wallet balance
const getWalletBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === "undefined" || walletId === "null") {
      res.status(400).json({
        success: false,
        message: "Valid walletId is required",
      });
      return;
    }

    const wallet = await Wallet.findByPk(walletId);

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive,
      },
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get transaction history for a wallet
const getTransactionHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === "undefined" || walletId === "null") {
      res.status(400).json({
        success: false,
        message: "Valid walletId is required",
      });
      return;
    }

    const {
      page = 1,
      limit = 10,
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where clause
    const whereClause: any = {
      [Op.or]: [{ senderWalletId: walletId }, { receiverWalletId: walletId }],
    };

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [
          new Date(startDate as string),
          new Date(endDate as string),
        ],
      };
    }

    const { count, rows: transactions } =
      await TransactionModel.findAndCountAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit as string),
        offset,
        include: [
          {
            model: Category,
            as: "category",
            required: false,
          },
          {
            model: Wallet,
            as: "senderWallet",
            attributes: ["id", "userId", "currency"],
          },
          {
            model: Wallet,
            as: "receiverWallet",
            attributes: ["id", "userId", "currency"],
          },
        ],
      });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit as string)),
        },
      },
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get single transaction details
const getTransactionDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { transactionId } = req.params;

    const transaction = await TransactionModel.findByPk(transactionId, {
      include: [
        {
          model: Category,
          as: "category",
          required: false,
        },
        {
          model: Wallet,
          as: "senderWallet",
          attributes: ["id", "userId", "organizationId", "currency"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
              required: false,
            },
            {
              model: Organization,
              as: "organization",
              attributes: ["id", "name", "email"],
              required: false,
            },
          ],
        },
        {
          model: Wallet,
          as: "receiverWallet",
          attributes: ["id", "userId", "organizationId", "currency"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
              required: false,
            },
            {
              model: Organization,
              as: "organization",
              attributes: ["id", "name", "email"],
              required: false,
            },
          ],
        },
      ],
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction details error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all categories
const getTransactionCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const categories = await Category.findAll({
      where: {
        isActive: true,
      },
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get user's wallet information
const getUserWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const wallet = await Wallet.findOne({
      where: { userId, isActive: true },
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: "Active wallet not found for this user",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive,
      },
    });
  } catch (error) {
    console.error("Get user wallet error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get organization's wallet information
const getOrganizationWallet = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { organizationId } = req.params;

    const wallet = await Wallet.findOne({
      where: { organizationId, isActive: true },
    });

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: "Active wallet not found for this organization",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        organizationId: wallet.organizationId,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency,
        isActive: wallet.isActive,
      },
    });
  } catch (error) {
    console.error("Get organization wallet error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get wallet restrictions
const getWalletRestrictions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === "undefined" || walletId === "null") {
      res.status(400).json({
        success: false,
        message: "Valid walletId is required",
      });
      return;
    }

    const restrictions = await WalletRestriction.findAll({
      where: { walletId },
      include: [
        {
          model: Category,
          as: "category",
          required: true,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: restrictions.map((restriction) => ({
        id: restriction.id,
        walletId: restriction.walletId,
        categoryId: restriction.categoryId,
        categoryName: (restriction as any).category?.name,
        categoryDescription: (restriction as any).category?.description,
        amount: parseFloat(restriction.amount.toString()),
        createdAt: (restriction as any).createdAt,
        updatedAt: (restriction as any).updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get wallet restrictions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get wallet balance breakdown (restricted vs unrestricted)
const getWalletBalanceBreakdown = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { walletId } = req.params;

    // Validate walletId
    if (!walletId || walletId === "undefined" || walletId === "null") {
      res.status(400).json({
        success: false,
        message: "Valid walletId is required",
      });
      return;
    }

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
      return;
    }

    const restrictions = await WalletRestriction.findAll({
      where: { walletId },
      include: [
        {
          model: Category,
          as: "category",
          required: true,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const totalBalance = parseFloat(wallet.balance.toString());
    const totalRestrictedAmount = restrictions.reduce(
      (sum, restriction) => sum + parseFloat(restriction.amount.toString()),
      0,
    );
    const availableUnrestrictedAmount = totalBalance - totalRestrictedAmount;

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.id,
        totalBalance,
        availableUnrestrictedAmount,
        totalRestrictedAmount,
        restrictions: restrictions.map((restriction) => ({
          id: restriction.id,
          categoryId: restriction.categoryId,
          categoryName: (restriction as any).category?.name,
          categoryDescription: (restriction as any).category?.description,
          amount: parseFloat(restriction.amount.toString()),
        })),
      },
    });
  } catch (error) {
    console.error("Get wallet balance breakdown error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Unified endpoint to get all transactions with role-based filtering
 * - Admins see ALL transactions
 * - Regular users see only their own transactions (sent or received)
 * - Organization admins see their organization's transactions
 */
const getAllTransactions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all",
      type = "all",
      startDate,
      endDate,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClause: any = {};

    // Role-based filtering
    // Admin users (super_admin or admin) see ALL transactions
    // Regular users only see transactions they're involved in
    if (!req.user?.isAdmin) {
      // Regular user: only see their own transactions
      const userWallets = await Wallet.findAll({
        where: { userId: req.user?.id },
        attributes: ["id"],
      });
      const walletIds = userWallets.map((w) => w.id);

      whereClause[Op.or] = [
        { senderWalletId: { [Op.in]: walletIds } },
        { receiverWalletId: { [Op.in]: walletIds } },
      ];
    }
    // Admin users: no additional where clause - they see everything

    // Filter by status
    if (status !== "all") {
      whereClause.status = status;
    }

    // Filter by type
    if (type !== "all") {
      whereClause.type = type;
    }

    // Filter by date range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    // Search by reference ID or description
    if (search) {
      whereClause[Op.or] = [
        ...(whereClause[Op.or] || []),
        { referenceId: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { externalSenderName: { [Op.iLike]: `%${search}%` } },
        { senderNames: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { count, rows: transactions } =
      await models.Transaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: models.Wallet,
            as: "senderWallet",
            attributes: ["id", "balance", "currency"],
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email", "phone"],
              },
              {
                model: models.Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
              },
            ],
          },
          {
            model: models.Wallet,
            as: "receiverWallet",
            attributes: ["id", "balance", "currency"],
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email", "phone"],
              },
              {
                model: models.Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
              },
            ],
          },
          {
            model: models.Category,
            as: "category",
            attributes: ["id", "name"],
          },
          {
            model: models.ActionPurchase,
            as: "actionPurchase",
            attributes: ["id", "quantity", "totalAmount"],
            include: [
              {
                model: models.Action,
                as: "action",
                attributes: ["id", "name", "type"],
              },
              {
                model: models.SubAction,
                as: "subAction",
                attributes: ["id", "name", "price"],
              },
            ],
          },
        ],
        limit: Number(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

    // Calculate statistics (only for data user can see)
    const stats = await models.Transaction.findAll({
      where: whereClause,
      attributes: [
        [fn("COUNT", col("id")), "total"],
        [fn("SUM", col("amount")), "totalAmount"],
        "status",
        "type",
      ],
      group: ["status", "type"],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: transactions,
      statistics: stats,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

/**
 * Unified endpoint to get single transaction by ID with role-based access
 */
const getTransactionById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const transaction = await models.Transaction.findByPk(id, {
      include: [
        {
          model: models.Wallet,
          as: "senderWallet",
          include: [
            {
              model: models.User,
              as: "user",
              attributes: {
                exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
              },
            },
            {
              model: models.Organization,
              as: "organization",
            },
          ],
        },
        {
          model: models.Wallet,
          as: "receiverWallet",
          include: [
            {
              model: models.User,
              as: "user",
              attributes: {
                exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
              },
            },
            {
              model: models.Organization,
              as: "organization",
            },
          ],
        },
        {
          model: models.Category,
          as: "category",
        },
        {
          model: models.ActionPurchase,
          as: "actionPurchase",
          include: [
            {
              model: models.Action,
              as: "action",
            },
            {
              model: models.SubAction,
              as: "subAction",
            },
          ],
        },
      ],
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
      return;
    }

    // Role-based access control
    // Admin users can view any transaction
    // Regular users can only view transactions they're involved in
    if (!req.user?.isAdmin) {
      // Check if user is involved in this transaction
      const userWallets = await Wallet.findAll({
        where: { userId: req.user?.id },
        attributes: ["id"],
      });
      const walletIds = userWallets.map((w) => w.id);

      const isInvolved =
        walletIds.includes(transaction.senderWalletId) ||
        walletIds.includes(transaction.receiverWalletId);

      if (!isInvolved) {
        res.status(403).json({
          success: false,
          message: "You don't have permission to view this transaction",
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    console.error("Get transaction by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transaction",
      error: error.message,
    });
  }
};

// Get recent send recipients for authenticated user
const getRecentSends = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const authenticatedUserId = req.user.id;
    const { limit = 15 } = req.query;

    // Get authenticated user's wallet
    const userWallet = await Wallet.findOne({
      where: { userId: authenticatedUserId, isActive: true },
    });

    if (!userWallet) {
      res.status(404).json({
        success: false,
        message: "User wallet not found",
      });
      return;
    }

    // Get all completed transactions where user is the sender
    const transactions = await TransactionModel.findAll({
      where: {
        senderWalletId: userWallet.id,
        status: "completed",
        type: {
          [Op.in]: ["transfer", "payment", "donation"],
        },
      },
      include: [
        {
          model: Wallet,
          as: "receiverWallet",
          attributes: ["id", "userId", "organizationId", "currency"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email", "phone"],
              required: false,
            },
            {
              model: Organization,
              as: "organization",
              attributes: ["id", "name", "email", "contactPhone"],
              required: false,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Group transactions by receiver and get the most recent one for each
    const receiverMap = new Map();

    for (const transaction of transactions) {
      const receiverWallet = (transaction as any).receiverWallet;
      if (!receiverWallet) continue;

      const receiverId = receiverWallet.userId || receiverWallet.organizationId;
      if (!receiverId) continue;

      // Only keep the first (most recent) transaction for each receiver
      if (!receiverMap.has(receiverId)) {
        const receiver = receiverWallet.user || receiverWallet.organization;
        if (!receiver) continue;

        receiverMap.set(receiverId, {
          receiverId,
          receiverType: receiverWallet.userId ? "user" : "organization",
          receiverName: receiverWallet.userId
            ? `${receiver.firstName} ${receiver.lastName}`
            : receiver.name,
          receiverPhone: receiverWallet.userId
            ? receiver.phone
            : receiver.contactPhone || null,
          receiverEmail: receiver.email || null,
          lastTransactionId: transaction.id,
          lastTransactionDate: (transaction as any).createdAt,
          lastTransactionAmount: parseFloat(transaction.amount.toString()),
          lastTransactionDescription: (transaction as any).description || null,
          lastTransactionType: transaction.type,
        });
      }
    }

    // Convert map to array and limit results
    const recentSends = Array.from(receiverMap.values()).slice(
      0,
      parseInt(limit as string),
    );

    res.status(200).json({
      success: true,
      data: recentSends,
    });
  } catch (error) {
    console.error("Get recent sends error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  transferMoney,
  getWalletBalance,
  getUserWallet,
  getOrganizationWallet,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionCategories,
  getWalletRestrictions,
  getWalletBalanceBreakdown,
  getRecentSends,
  getAllTransactions,
  getTransactionById,
};
