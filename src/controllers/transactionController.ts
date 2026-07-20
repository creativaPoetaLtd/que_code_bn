import { Request, Response, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import { Op, fn, col } from 'sequelize';
import * as bcrypt from 'bcrypt';
import database_models from '../database/config/db.config';
import {
  notifyPaymentReceived,
  notifyPaymentSent,
  notifyPaymentFailed,
  notifyTransactionCompleted,
  notifyLargeTransaction,
  notifyPaymentRequestReceived,
  notifyPaymentRequestDeclined,
  notifyPaymentRequestAccepted,
} from '../utils/notificationHelpers';
import { AuthRequest } from '../middleware/auth.unified.middleware';

const {
  Wallet,
  Transaction: TransactionModel,
  Category,
  WalletRestriction,
  User,
  Organization,
  Profile,
  PaymentRequest,
  Action,
  SubAction,
  Group,
  PublicContribution,
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
      senderSubActionId,
      receiverUserId,
      receiverOrganizationId,
      receiverWalletId,
      amount,
      description = "",
      categoryId,
      type = "transfer",
      applyConstraints = false, // New parameter to control constraint application
      pin, // PIN for verification
      paymentRequestId, // ID of the request being fulfilled
    } = req.body;

    // Validation - exactly one sender target and one receiver target must be provided
    const senderTargets = [
      senderUserId,
      senderOrganizationId,
      senderSubActionId,
    ].filter(Boolean).length;
    const receiverTargets = [
      receiverUserId,
      receiverOrganizationId,
      receiverWalletId,
    ].filter(Boolean).length;

    if (senderTargets !== 1 || receiverTargets !== 1 || !amount) {
      res.status(400).json({
        success: false,
        message:
          "Exactly one sender (user, organization, or sub-action), one receiver (user, organization, or wallet), and amount are required",
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
    const authUser = (req as unknown as AuthRequest).user;
    const requesterOrganizationId =
      authUser?.accountType === "organization"
        ? authUser.id
        : authUser?.organizationId || null;

    // For user-to-user transfers, authenticated user must be the sender
    if (senderUserId && senderUserId !== authenticatedUserId) {
      res.status(403).json({
        success: false,
        message: "You can only send money from your own account",
      });
      return;
    }

    // For organization transfers, authenticated identity must belong to the sender organization
    if (senderOrganizationId) {
      if (!requesterOrganizationId || senderOrganizationId !== requesterOrganizationId) {
        res.status(403).json({
          success: false,
          message: "You are not authorized to send money from this organization",
        });
        return;
      }
    }

    // For sub-action transfers, authenticated identity must belong to the owning organization
    if (senderSubActionId) {
      if (!requesterOrganizationId) {
        res.status(403).json({
          success: false,
          message: "Organization context is required to send from a sub-action wallet",
        });
        return;
      }

      const subActionRecord: any = await SubAction.findByPk(senderSubActionId, {
        include: [
          {
            model: Action,
            as: "action",
            attributes: ["id", "organizationId"],
          },
        ],
      });

      if (!subActionRecord) {
        res.status(404).json({
          success: false,
          message: "Sender sub-action not found",
        });
        return;
      }

      const ownerOrganizationId = subActionRecord.action?.organizationId;
      if (!ownerOrganizationId || ownerOrganizationId !== requesterOrganizationId) {
        res.status(403).json({
          success: false,
          message: "You are not authorized to send money from this sub-action wallet",
        });
        return;
      }
    }

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
      : senderOrganizationId
        ? { organizationId: senderOrganizationId, isActive: true }
        : { subActionId: senderSubActionId, isActive: true };

    const receiverWhere = receiverUserId
      ? { userId: receiverUserId, isActive: true }
      : receiverOrganizationId
        ? { organizationId: receiverOrganizationId, isActive: true }
        : { id: receiverWalletId, isActive: true };

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

    if (senderWallet.id === receiverWallet.id) {
      await transaction?.rollback();
      res.status(400).json({
        success: false,
        message: "Cannot transfer to the same wallet",
      });
      return;
    }

    const receiverIsUser = !!receiverWallet.userId;

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
    if (receiverIsUser) {
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
    if (categoryId && !receiverIsUser) {
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
    
    // Update payment request if fulfilling one
    if (paymentRequestId) {
      try {
        const paymentRequest = await PaymentRequest.findByPk(paymentRequestId as string);
        if (paymentRequest && paymentRequest.recipientId === authenticatedUserId) {
          await paymentRequest.update({
            status: 'paid',
            transactionId: newTransaction.id
          });
          console.log(`Payment request ${paymentRequestId} marked as paid`);
        }
      } catch (err) {
        console.error("Error updating payment request status:", err);
      }
    }
    
    // Send notifications to both sender and receiver
    try {
      // Get sender and receiver names for notification
      let senderName = 'A user';
      let receiverName = 'A user';

      if (senderUserId) {
        const sender = await User.findByPk(senderUserId);
        senderName = sender ? `${sender.firstName} ${sender.lastName}` : senderName;
      } else if (senderOrganizationId) {
        const senderOrg = await Organization.findByPk(senderOrganizationId);
        senderName = senderOrg ? senderOrg.name : senderName;
      }

      if (receiverUserId) {
        const receiver = await User.findByPk(receiverUserId);
        receiverName = receiver ? `${receiver.firstName} ${receiver.lastName}` : receiverName;
      } else if (receiverOrganizationId) {
        const receiverOrg = await Organization.findByPk(receiverOrganizationId);
        receiverName = receiverOrg ? receiverOrg.name : receiverName;
      }

      // Notify receiver about payment received
      if (receiverUserId) {
        await notifyPaymentReceived(
          req.app,
          receiverUserId,
          newTransaction.id,
          transferAmount,
          senderWallet.currency || 'RWF',
          senderName
        );
      }

      // Notify sender about payment sent
      if (senderUserId) {
        await notifyPaymentSent(
          req.app,
          senderUserId,
          newTransaction.id,
          transferAmount,
          senderWallet.currency || 'RWF',
          receiverName
        );
      }

      // Notify sender about transaction completion
      if (senderUserId) {
        await notifyTransactionCompleted(
          req.app,
          senderUserId,
          newTransaction.id,
          transferAmount,
          senderWallet.currency || 'RWF',
          type || 'transfer',
          receiverName
        );
      }

      // Large transaction alert (threshold: 100,000 RWF or equivalent)
      const largeTransactionThreshold = 100000;
      if (transferAmount >= largeTransactionThreshold) {
        if (senderUserId) {
          await notifyLargeTransaction(
            req.app,
            senderUserId,
            newTransaction.id,
            transferAmount,
            senderWallet.currency || 'RWF',
            type || 'transfer',
            largeTransactionThreshold
          );
        }
        if (receiverUserId) {
          await notifyLargeTransaction(
            req.app,
            receiverUserId,
            newTransaction.id,
            transferAmount,
            senderWallet.currency || 'RWF',
            type || 'transfer',
            largeTransactionThreshold
          );
        }
      }
    } catch (notificationError) {
      // Log notification error but don't fail the transaction
      console.error('Notification error:', notificationError);
    }

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
        senderSubActionId: senderSubActionId || null,
        receiverUserId: receiverUserId || null,
        receiverOrganizationId: receiverOrganizationId || null,
        receiverWalletId: receiverWalletId || null,
        resolvedReceiverWalletId: receiverWallet.id,
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

    const wallet = await Wallet.findByPk(walletId as string);

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
      contactId,
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const contactIdStr = contactId ? String(contactId) : undefined;

    // Build where clause
    const whereClause: any = {
      [Op.or]: [{ senderWalletId: walletId }, { receiverWalletId: walletId }],
    };

    // Filter by contact if provided
    if (contactIdStr) {
      // Find the contact's wallet first
      const contactWallet = await Wallet.findOne({
        where: { userId: contactIdStr }
      });

      if (contactWallet) {
        whereClause[Op.and] = [
          {
            [Op.or]: [
              { senderWalletId: contactWallet.id },
              { receiverWalletId: contactWallet.id }
            ]
          }
        ];
      } else {
        // If contact has no wallet, they can't have transactions. Return empty.
        res.status(200).json({
          success: true,
          data: {
            transactions: [],
            pagination: {
              page: parseInt(page as string),
              limit: parseInt(limit as string),
              total: 0,
              totalPages: 0
            }
          }
        });
        return;
      }
    }

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
            attributes: ["id", "userId", "organizationId", "currency"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email"],
                include: [
                  {
                    model: Profile,
                    as: "profile",
                    attributes: ["profileImage"],
                  },
                ],
                required: false,
              },
              {
                model: Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
                required: false,
              },
              {
                model: Group,
                as: "group",
                attributes: ["id", "name", "profilePictureUrl"],
                required: false,
              },
              {
                model: PublicContribution,
                as: "publicContribution",
                attributes: ["id", "title"],
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
                include: [
                  {
                    model: Profile,
                    as: "profile",
                    attributes: ["profileImage"],
                  },
                ],
                required: false,
              },
              {
                model: Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
                required: false,
              },
              {
                model: Group,
                as: "group",
                attributes: ["id", "name", "profilePictureUrl"],
                required: false,
              },
              {
                model: PublicContribution,
                as: "publicContribution",
                attributes: ["id", "title"],
                required: false,
              },
            ],
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
    const { id } = req.params;

    const transaction = await TransactionModel.findByPk(id as string, {
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
              include: [
                {
                  model: Profile,
                  as: "profile",
                  attributes: ["profileImage"],
                },
              ],
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
              include: [
                {
                  model: Profile,
                  as: "profile",
                  attributes: ["profileImage"],
                },
              ],
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

    const wallet = await Wallet.findByPk(walletId as string);
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
 * Unified endpoint to list all wallets for admin usage
 * Supports user, organization, and action wallet types in one response
 */
const getAllWallets = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can access all wallets",
      });
      return;
    }

    const {
      page = 1,
      limit = 20,
      search = "",
      ownerType = "all",
      status = "all",
      sortBy = "updatedAt",
      sortDirection = "desc",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 20);
    const normalizedOwnerType = String(ownerType).toLowerCase();
    const normalizedStatus = String(status).toLowerCase();
    const normalizedSortBy = String(sortBy);
    const normalizedSortDirection =
      String(sortDirection).toLowerCase() === "asc" ? "asc" : "desc";

    const whereClause: any = {};
    if (normalizedStatus === "active") {
      whereClause.isActive = true;
    } else if (normalizedStatus === "inactive") {
      whereClause.isActive = false;
    }

    const models = req.app.get("models") as typeof database_models;

    const wallets = await models.Wallet.findAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
          required: false,
        },
        {
          model: models.Organization,
          as: "organization",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: models.Group,
          as: "group",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const walletIds = wallets.map((wallet) => wallet.id);

    const [restrictionRows, transactionRows] = await Promise.all([
      walletIds.length > 0
        ? models.WalletRestriction.findAll({
          where: {
            walletId: {
              [Op.in]: walletIds,
            },
          },
          attributes: [
            "walletId",
            [fn("COUNT", col("id")), "restrictionsCount"],
            [fn("COALESCE", fn("SUM", col("amount")), 0), "totalRestricted"],
          ],
          group: ["walletId"],
          raw: true,
        })
        : [],
      walletIds.length > 0
        ? models.Transaction.findAll({
          where: {
            [Op.or]: [
              {
                senderWalletId: {
                  [Op.in]: walletIds,
                },
              },
              {
                receiverWalletId: {
                  [Op.in]: walletIds,
                },
              },
            ],
          },
          attributes: ["senderWalletId", "receiverWalletId", "createdAt"],
          raw: true,
        })
        : [],
    ]);

    const restrictionMap = new Map<
      string,
      { restrictionsCount: number; totalRestricted: number }
    >();

    (restrictionRows as any[]).forEach((row) => {
      restrictionMap.set(row.walletId, {
        restrictionsCount: Number(row.restrictionsCount || 0),
        totalRestricted: Number(row.totalRestricted || 0),
      });
    });

    const transactionStatsMap = new Map<
      string,
      { transactionCount: number; lastTransaction: Date | null }
    >();

    walletIds.forEach((walletId) => {
      transactionStatsMap.set(walletId, {
        transactionCount: 0,
        lastTransaction: null,
      });
    });

    (transactionRows as any[]).forEach((transaction) => {
      const createdAt = new Date(transaction.createdAt);

      const senderStats = transactionStatsMap.get(transaction.senderWalletId);
      if (senderStats) {
        senderStats.transactionCount += 1;
        if (
          !senderStats.lastTransaction ||
          createdAt > senderStats.lastTransaction
        ) {
          senderStats.lastTransaction = createdAt;
        }
      }

      const receiverStats = transactionStatsMap.get(
        transaction.receiverWalletId,
      );
      if (receiverStats) {
        receiverStats.transactionCount += 1;
        if (
          !receiverStats.lastTransaction ||
          createdAt > receiverStats.lastTransaction
        ) {
          receiverStats.lastTransaction = createdAt;
        }
      }
    });

    const normalizedWallets = wallets.map((wallet: any) => {
      const restrictionStats = restrictionMap.get(wallet.id) || {
        restrictionsCount: 0,
        totalRestricted: 0,
      };

      const transactionStats = transactionStatsMap.get(wallet.id) || {
        transactionCount: 0,
        lastTransaction: null,
      };

      let resolvedOwnerType: "user" | "organization" | "action" = "action";
      let ownerName = "Action Wallet";

      if (wallet.userId) {
        resolvedOwnerType = "user";
        ownerName =
          `${wallet.user?.firstName || ""} ${wallet.user?.lastName || ""}`.trim();
        if (!ownerName) ownerName = wallet.user?.email || "User Wallet";
      } else if (wallet.organizationId) {
        resolvedOwnerType = "organization";
        ownerName =
          wallet.organization?.name ||
          wallet.organization?.email ||
          "Organization Wallet";
      } else if (wallet.groupId) {
        resolvedOwnerType = "action";
        ownerName = wallet.group?.name || "Action Wallet";
      }

      const balance = Number(wallet.balance || 0);
      const availableBalance = Math.max(
        0,
        balance - restrictionStats.totalRestricted,
      );

      return {
        id: wallet.id,
        userId: wallet.userId || null,
        organizationId: wallet.organizationId || null,
        groupId: wallet.groupId || null,
        ownerName,
        ownerType: resolvedOwnerType,
        balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        restrictionsCount: restrictionStats.restrictionsCount,
        totalRestricted: restrictionStats.totalRestricted,
        availableBalance,
        transactionCount: transactionStats.transactionCount,
        lastTransaction: transactionStats.lastTransaction,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      };
    });

    const searchQuery = String(search).trim().toLowerCase();

    let filteredWallets = normalizedWallets.filter((wallet) => {
      if (
        normalizedOwnerType !== "all" &&
        wallet.ownerType !== normalizedOwnerType
      ) {
        return false;
      }

      if (!searchQuery) {
        return true;
      }

      return (
        wallet.id.toLowerCase().includes(searchQuery) ||
        wallet.ownerName.toLowerCase().includes(searchQuery) ||
        wallet.currency.toLowerCase().includes(searchQuery)
      );
    });

    filteredWallets = filteredWallets.sort((first, second) => {
      const firstValue = (first as any)[normalizedSortBy];
      const secondValue = (second as any)[normalizedSortBy];

      if (firstValue == null && secondValue == null) return 0;
      if (firstValue == null) return normalizedSortDirection === "asc" ? -1 : 1;
      if (secondValue == null)
        return normalizedSortDirection === "asc" ? 1 : -1;

      const firstComparable =
        firstValue instanceof Date ? firstValue.getTime() : firstValue;
      const secondComparable =
        secondValue instanceof Date ? secondValue.getTime() : secondValue;

      if (firstComparable < secondComparable) {
        return normalizedSortDirection === "asc" ? -1 : 1;
      }
      if (firstComparable > secondComparable) {
        return normalizedSortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

    const total = filteredWallets.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedData = filteredWallets.slice(
      startIndex,
      startIndex + pageSize,
    );

    res.status(200).json({
      success: true,
      data: paginatedData,
      statistics: {
        total,
        active: filteredWallets.filter((wallet) => wallet.isActive).length,
        inactive: filteredWallets.filter((wallet) => !wallet.isActive).length,
        users: filteredWallets.filter((wallet) => wallet.ownerType === "user")
          .length,
        organizations: filteredWallets.filter(
          (wallet) => wallet.ownerType === "organization",
        ).length,
        actions: filteredWallets.filter(
          (wallet) => wallet.ownerType === "action",
        ).length,
      },
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get all wallets error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching wallets",
      error: error.message,
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

    const models = req.app.get("models") as typeof database_models;
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
                include: [
                  {
                    model: models.Profile,
                    as: "profile",
                    attributes: ["profileImage"],
                  },
                ],
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
                include: [
                  {
                    model: models.Profile,
                    as: "profile",
                    attributes: ["profileImage"],
                  },
                ],
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

    const models = req.app.get("models") as typeof database_models;
    const transaction = await models.Transaction.findByPk(id as string, {
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
              include: [
                {
                  model: models.Profile,
                  as: "profile",
                  attributes: ["profileImage"],
                },
              ],
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
              include: [
                {
                  model: models.Profile,
                  as: "profile",
                  attributes: ["profileImage"],
                },
              ],
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
              include: [
                {
                  model: Profile,
                  as: "profile",
                  attributes: ["profileImage"],
                },
              ],
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

        const profileImage = receiver.profile?.profileImage ||
          (receiverWallet.userId ? null : receiver.profile?.logo) ||
          null;

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
          receiverProfileImage: profileImage,
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

// Get contact transaction stats
const getContactStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId } = req.params;
    const { contactId } = req.query;

    if (!walletId) {
      res.status(400).json({ success: false, message: 'Wallet ID is required' });
      return;
    }

    if (!contactId) {
      res.status(400).json({ success: false, message: 'Contact ID is required' });
      return;
    }

    // Find contact's wallet
    const contactWallet = await Wallet.findOne({ where: { userId: String(contactId) } });

    if (!contactWallet) {
      res.status(200).json({
        success: true,
        data: {
          totalSent: 0,
          totalReceived: 0
        }
      });
      return;
    }

    // Calculate total sent to contact
    const totalSent = await TransactionModel.sum('amount', {
      where: {
        senderWalletId: walletId,
        receiverWalletId: contactWallet.id,
        status: 'completed'
      }
    });

    // Calculate total received from contact
    const totalReceived = await TransactionModel.sum('amount', {
      where: {
        senderWalletId: contactWallet.id,
        receiverWalletId: walletId,
        status: 'completed'
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalSent: totalSent || 0,
        totalReceived: totalReceived || 0
      }
    });

  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all wallet restrictions (admin only)
const getAllRestrictions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can access all restrictions",
      });
      return;
    }

    const {
      page = 1,
      limit = 20,
      search = "",
      categoryId = "",
      sortBy = "updatedAt",
      sortDirection = "desc",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 20);
    const normalizedSortBy = String(sortBy);
    const normalizedSortDirection =
      String(sortDirection).toLowerCase() === "asc" ? "asc" : "desc";

    const models = req.app.get("models") as typeof database_models;
    const whereClause: any = {};

    if (categoryId && categoryId !== "all") {
      whereClause.categoryId = categoryId;
    }

    // Get all restrictions with wallet and category info
    const restrictions = await models.WalletRestriction.findAll({
      where: whereClause,
      include: [
        {
          model: models.Category,
          as: "category",
          attributes: ["id", "name", "description"],
          required: true,
        },
        {
          model: models.Wallet,
          as: "wallet",
          attributes: ["id", "userId", "organizationId", "groupId"],
          include: [
            {
              model: models.User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
              required: false,
            },
            {
              model: models.Organization,
              as: "organization",
              attributes: ["id", "name", "email"],
              required: false,
            },
            {
              model: models.Group,
              as: "group",
              attributes: ["id", "name"],
              required: false,
            },
          ],
          required: true,
        },
      ],
      order: [[normalizedSortBy, normalizedSortDirection]],
    });

    // Get usage statistics for each restriction
    const restrictionIds = restrictions.map((r) => r.id);
    const transactionUsage = await models.Transaction.findAll({
      where: {
        categoryId: {
          [Op.in]: restrictions.map((r) => r.categoryId),
        },
        status: "completed",
      },
      attributes: [
        [fn("COUNT", col("id")), "transactionCount"],
        [col("categoryId"), "categoryId"],
      ],
      group: ["categoryId"],
      raw: true,
    });

    const usageMap = new Map<string, number>();
    (transactionUsage as any[]).forEach((usage) => {
      usageMap.set(usage.categoryId, Number(usage.transactionCount || 0));
    });

    // Normalize restrictions with wallet owner info
    const normalizedRestrictions = restrictions.map((restriction: any) => {
      const wallet = restriction.wallet;
      let ownerName = "Unknown";
      let walletOwnerType: "user" | "organization" | "action" = "action";

      if (wallet.userId && wallet.user) {
        walletOwnerType = "user";
        ownerName =
          `${wallet.user.firstName || ""} ${wallet.user.lastName || ""}`.trim();
        if (!ownerName) ownerName = wallet.user.email || "User";
      } else if (wallet.organizationId && wallet.organization) {
        walletOwnerType = "organization";
        ownerName =
          wallet.organization.name ||
          wallet.organization.email ||
          "Organization";
      } else if (wallet.groupId && wallet.group) {
        walletOwnerType = "action";
        ownerName = wallet.group.name || "Action";
      }

      const amount = Number(restriction.amount || 0);
      const usedAmount = 0; // TODO: Calculate from transactions
      const remainingAmount = Math.max(0, amount - usedAmount);
      const transactionCount = usageMap.get(restriction.categoryId) || 0;

      return {
        id: restriction.id,
        walletId: restriction.walletId,
        walletOwner: ownerName,
        walletOwnerType,
        categoryId: restriction.categoryId,
        categoryName: restriction.category?.name || "Unknown",
        categoryDescription: restriction.category?.description || "",
        amount,
        usedAmount,
        remainingAmount,
        transactionCount,
        createdAt: restriction.createdAt,
        updatedAt: restriction.updatedAt,
      };
    });

    // Apply search filter
    const searchQuery = String(search).trim().toLowerCase();
    let filteredRestrictions = normalizedRestrictions;

    if (searchQuery) {
      filteredRestrictions = normalizedRestrictions.filter((restriction) => {
        return (
          restriction.walletOwner.toLowerCase().includes(searchQuery) ||
          restriction.categoryName.toLowerCase().includes(searchQuery) ||
          restriction.categoryDescription.toLowerCase().includes(searchQuery) ||
          restriction.id.toLowerCase().includes(searchQuery)
        );
      });
    }

    // Pagination
    const total = filteredRestrictions.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedRestrictions = filteredRestrictions.slice(
      startIndex,
      startIndex + pageSize,
    );

    // Statistics
    const totalRestrictions = filteredRestrictions.length;
    const activeRestrictions = filteredRestrictions.filter(
      (r) => r.remainingAmount > 0,
    ).length;
    const exhaustedRestrictions = filteredRestrictions.filter(
      (r) => r.remainingAmount === 0,
    ).length;
    const unusedRestrictions = filteredRestrictions.filter(
      (r) => r.usedAmount === 0,
    ).length;
    const totalAllocated = filteredRestrictions.reduce(
      (sum, r) => sum + r.amount,
      0,
    );
    const totalUsed = filteredRestrictions.reduce(
      (sum, r) => sum + r.usedAmount,
      0,
    );
    const totalRemaining = filteredRestrictions.reduce(
      (sum, r) => sum + r.remainingAmount,
      0,
    );

    res.status(200).json({
      success: true,
      data: paginatedRestrictions,
      statistics: {
        total: totalRestrictions,
        active: activeRestrictions,
        exhausted: exhaustedRestrictions,
        unused: unusedRestrictions,
        totalAllocated,
        totalUsed,
        totalRemaining,
      },
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all restrictions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create a new wallet restriction
 * POST /api/v1/transactions/restrictions
 */
export const createRestriction: RequestHandler = async (req, res) => {
  try {
    const { walletId, categoryId, amount } = req.body;

    // Validate required fields
    if (!walletId || !categoryId || amount === undefined) {
      res.status(400).json({
        success: false,
        message: "walletId, categoryId, and amount are required",
      });
      return;
    }

    // Validate amount
    const restrictionAmount = Number(amount);
    if (isNaN(restrictionAmount) || restrictionAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
      return;
    }

    const models = req.app.get("models") as typeof database_models;

    // Verify wallet exists
    const wallet = await models.Wallet.findByPk(walletId);
    if (!wallet) {
      res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
      return;
    }

    // Verify category exists
    const category = await models.Category.findByPk(categoryId);
    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    // Check if restriction already exists
    const existingRestriction = await models.WalletRestriction.findOne({
      where: { walletId, categoryId },
    });

    if (existingRestriction) {
      res.status(409).json({
        success: false,
        message: "Restriction already exists for this wallet and category",
      });
      return;
    }

    // Create restriction
    const restriction = await models.WalletRestriction.create({
      walletId,
      categoryId,
      amount: restrictionAmount,
    });

    // Fetch with associations for response
    const createdRestriction = await models.WalletRestriction.findByPk(
      restriction.id,
      {
        include: [
          {
            model: models.Category,
            as: "category",
            attributes: ["id", "name", "description"],
          },
          {
            model: models.Wallet,
            as: "wallet",
            attributes: ["id", "userId", "organizationId", "groupId"],
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email"],
                required: false,
              },
              {
                model: models.Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
                required: false,
              },
              {
                model: models.Group,
                as: "group",
                attributes: ["id", "name"],
                required: false,
              },
            ],
          },
        ],
      },
    );

    res.status(201).json({
      success: true,
      message: "Restriction created successfully",
      data: createdRestriction,
    });
  } catch (error: any) {
    console.error("Create restriction error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Update a wallet restriction
 * PUT /api/v1/transactions/restrictions/:id
 */
export const updateRestriction: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined) {
      res.status(400).json({
        success: false,
        message: "Amount is required",
      });
      return;
    }

    const restrictionAmount = Number(amount);
    if (isNaN(restrictionAmount) || restrictionAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
      return;
    }

    const models = req.app.get("models") as typeof database_models;

    const restriction = await models.WalletRestriction.findByPk(id as string);
    if (!restriction) {
      res.status(404).json({
        success: false,
        message: "Restriction not found",
      });
      return;
    }

    // Update restriction
    await restriction.update({ amount: restrictionAmount });

    // Fetch with associations for response
    const updatedRestriction = await models.WalletRestriction.findByPk(id as string, {
      include: [
        {
          model: models.Category,
          as: "category",
          attributes: ["id", "name", "description"],
        },
        {
          model: models.Wallet,
          as: "wallet",
          attributes: ["id", "userId", "organizationId", "groupId"],
          include: [
            {
              model: models.User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
              required: false,
            },
            {
              model: models.Organization,
              as: "organization",
              attributes: ["id", "name", "email"],
              required: false,
            },
            {
              model: models.Group,
              as: "group",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Restriction updated successfully",
      data: updatedRestriction,
    });
  } catch (error) {
    console.error("Update restriction error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete a wallet restriction
 * DELETE /api/v1/transactions/restrictions/:id
 */
export const deleteRestriction: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const models = req.app.get("models") as typeof database_models;

    const restriction = await models.WalletRestriction.findByPk(id as string);
    if (!restriction) {
      res.status(404).json({
        success: false,
        message: "Restriction not found",
      });
      return;
    }

    // Check if restriction has been used in transactions
    const transactionCount = await models.Transaction.count({
      where: {
        [Op.or]: [
          { senderWalletId: restriction.walletId },
          { receiverWalletId: restriction.walletId },
        ],
        categoryId: restriction.categoryId,
        status: "completed",
      },
    });

    if (transactionCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete restriction. It has been used in ${transactionCount} completed transaction(s).`,
      });
      return;
    }

    // Delete restriction
    await restriction.destroy();

    res.status(200).json({
      success: true,
      message: "Restriction deleted successfully",
    });
  } catch (error) {
    console.error("Delete restriction error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Create a payment request
const createPaymentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      recipientId,
      amount,
      note,
      allowEditAmount = false,
      currency = "RWF"
    } = req.body;

    const senderId = req.user.id;

    if (!recipientId || !amount) {
      res.status(400).json({
        success: false,
        message: "Recipient and amount are required",
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

    if (recipientId === senderId) {
      res.status(400).json({
        success: false,
        message: "You cannot request money from yourself",
      });
      return;
    }

    // Verify recipient exists
    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
      res.status(404).json({
        success: false,
        message: "Recipient not found",
      });
      return;
    }

    // Check for duplicate requests in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentRequest = await PaymentRequest.findOne({
      where: {
        senderId,
        recipientId,
        amount: parseFloat(amount),
        createdAt: { [Op.gte]: oneMinuteAgo },
        status: "pending"
      }
    });

    if (recentRequest) {
      res.status(400).json({
        success: false,
        message: "A similar request was recently sent. Please wait.",
      });
      return;
    }

    // Create the request
    const paymentRequest = await PaymentRequest.create({
      senderId,
      recipientId,
      amount: parseFloat(amount),
      currency,
      note,
      allowEditAmount,
      status: "pending"
    });

    // Notify the recipient
    const sender = await User.findByPk(senderId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Someone";

    await notifyPaymentRequestReceived(
      req.app,
      recipientId,
      paymentRequest.id,
      paymentRequest.amount,
      paymentRequest.currency,
      senderName,
      note
    );

    res.status(201).json({
      success: true,
      message: "Payment request sent successfully",
      data: paymentRequest
    });
  } catch (error) {
    console.error("Create payment request error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get payment requests for the authenticated user
const getUserPaymentRequests = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type = "received" } = req.query; // 'sent' or 'received'

    const where: any = type === "sent" 
      ? { senderId: userId } 
      : { recipientId: userId };

    const requests = await PaymentRequest.findAll({
      where,
      include: [
        { model: User, as: "sender", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "recipient", attributes: ["id", "firstName", "lastName", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error("Get payment requests error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get a single payment request by ID
const getPaymentRequestById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await PaymentRequest.findByPk(id as string, {
      include: [
        { 
          model: User, 
          as: "sender", 
          attributes: ["id", "firstName", "lastName", "email"],
          include: [{ model: Profile, as: "profile", attributes: ["profileImage"] }] 
        },
        { 
          model: User, 
          as: "recipient", 
          attributes: ["id", "firstName", "lastName", "email"],
          include: [{ model: Profile, as: "profile", attributes: ["profileImage"] }]
        }
      ]
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: "Payment request not found"
      });
      return;
    }

    // Verify user is either sender or recipient
    if (request.senderId !== userId && request.recipientId !== userId) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view this request"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error("Get payment request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Accept a received payment request and process the payment
const acceptPaymentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const dbTransaction = await TransactionModel.sequelize!.transaction();

  try {
    const { id } = req.params;
    const { pin, chatId, customAmount } = req.body;
    const userId = req.user.id; // The payer (recipient of the request)

    if (!pin) {
      await dbTransaction.rollback();
      res.status(400).json({ success: false, message: "PIN is required" });
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      await dbTransaction.rollback();
      res.status(400).json({ success: false, message: "PIN must be exactly 4 digits" });
      return;
    }

    const request = await PaymentRequest.findByPk(id as string);
    if (!request) {
      await dbTransaction.rollback();
      res.status(404).json({ success: false, message: "Payment request not found" });
      return;
    }

    if (request.recipientId !== userId) {
      await dbTransaction.rollback();
      res.status(403).json({ success: false, message: "Only the recipient can accept this request" });
      return;
    }

    if (request.status !== "pending") {
      await dbTransaction.rollback();
      res.status(400).json({ success: false, message: "Only pending requests can be accepted" });
      return;
    }

    // Verify payer's PIN
    const payer = await User.findByPk(userId, { transaction: dbTransaction });
    if (!payer) {
      await dbTransaction.rollback();
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (!payer.hasPinSet || !payer.transactionPin) {
      await dbTransaction.rollback();
      res.status(403).json({
        success: false,
        message: "PIN not set up. Please set up your transaction PIN before making payments.",
        requiresPinSetup: true,
      });
      return;
    }

    if (payer.pinLockedUntil && payer.pinLockedUntil > new Date()) {
      const remainingTime = Math.ceil((payer.pinLockedUntil.getTime() - Date.now()) / 60000);
      await dbTransaction.rollback();
      res.status(429).json({
        success: false,
        message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: payer.pinLockedUntil,
        remainingMinutes: remainingTime,
      });
      return;
    }

    const isValidPin = await bcrypt.compare(pin, payer.transactionPin);
    if (!isValidPin) {
      const newAttempts = (payer.pinAttempts || 0) + 1;
      const maxAttempts = 5;
      const lockoutMinutes = 15;

      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        await payer.update({ pinAttempts: newAttempts, pinLockedUntil: lockedUntil }, { transaction: dbTransaction });
        await dbTransaction.rollback();
        res.status(429).json({
          success: false,
          message: `PIN verification failed. Account locked for ${lockoutMinutes} minutes due to too many failed attempts.`,
          attemptsRemaining: 0,
          lockedUntil,
          remainingMinutes: lockoutMinutes,
        });
        return;
      }

      await payer.update({ pinAttempts: newAttempts }, { transaction: dbTransaction });
      await dbTransaction.rollback();
      res.status(400).json({
        success: false,
        message: `Invalid PIN. ${maxAttempts - newAttempts} attempts remaining.`,
        attemptsRemaining: maxAttempts - newAttempts,
      });
      return;
    }

    // Reset PIN attempts on success
    await payer.update({ pinAttempts: 0, pinLockedUntil: null }, { transaction: dbTransaction });

    // Use customAmount if the request allows it, otherwise use the original amount
    let amount = Number(request.amount);
    if (request.allowEditAmount && customAmount && Number(customAmount) > 0) {
      amount = Number(customAmount);
    }
    const fee = 0;
    const totalAmount = amount + fee;

    // Lock and fetch payer wallet (debit)
    const payerWallet = await Wallet.findOne({
      where: { userId, isActive: true },
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!payerWallet) {
      await dbTransaction.rollback();
      res.status(404).json({ success: false, message: "Your wallet not found or inactive" });
      return;
    }

    if (Number(payerWallet.balance) < totalAmount) {
      await dbTransaction.rollback();
      res.status(400).json({
        success: false,
        message: `Insufficient balance. You have ${payerWallet.balance} RWF but need ${totalAmount} RWF`,
      });
      return;
    }

    // Lock and fetch requester wallet (credit)
    const requesterWallet = await Wallet.findOne({
      where: { userId: request.senderId, isActive: true },
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!requesterWallet) {
      await dbTransaction.rollback();
      res.status(404).json({ success: false, message: "Requester wallet not found or inactive" });
      return;
    }

    // Create transaction record
    const referenceId = `REQ-${(id as string).substring(0, 8)}-${Date.now()}`;
    const transactionRecord = await TransactionModel.create({
      senderWalletId: payerWallet.id,
      receiverWalletId: requesterWallet.id,
      amount,
      fee,
      totalAmount,
      currency: request.currency || "RWF",
      referenceId,
      type: "payment",
      description: request.note || "Payment for money request",
      status: "completed",
    } as any, { transaction: dbTransaction });

    // Update wallet balances
    await payerWallet.update({
      balance: Number(payerWallet.balance) - totalAmount,
    }, { transaction: dbTransaction });

    await requesterWallet.update({
      balance: Number(requesterWallet.balance) + amount,
    }, { transaction: dbTransaction });

    // Mark request as paid
    await request.update({ status: "paid", transactionId: transactionRecord.id }, { transaction: dbTransaction });

    await dbTransaction.commit();

    // Update the ChatMessage content in DB so fresh loads reflect the paid status
    if (chatId) {
      try {
        const chatMessages = await (database_models.ChatMessage as any).findAll({
          where: { chatId, messageType: "money" },
        });
        for (const chatMsg of chatMessages) {
          try {
            const parsed = JSON.parse(chatMsg.content);
            if (parsed?.type === "money_request" && parsed?.requestId === (id as string)) {
              await chatMsg.update({
                content: JSON.stringify({ ...parsed, status: "paid", amount }),
              });
              break;
            }
          } catch {
            // skip non-JSON messages
          }
        }
      } catch {
        // Non-critical: don't fail the whole request if DB update fails
      }
    }

    // Fetch names for notifications/events
    const requester = await User.findByPk(request.senderId);
    const payerName = `${payer.firstName} ${payer.lastName}`;
    const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : "Requester";

    // Send in-app notification to the requester
    await notifyPaymentRequestAccepted(
      req.app,
      request.senderId,
      request.id,
      amount,
      request.currency || "RWF",
      payerName,
    );

    // Emit real-time socket events so both parties' message cards update instantly
    const io = req.app.get("io");
    if (io) {
      const eventData = {
        requestId: request.id,
        status: "paid",
        transactionId: transactionRecord.id,
        referenceId,
        amount,
        currency: request.currency || "RWF",
        chatId: chatId || null,
        payerName,
        requesterName,
      };

      io.to(`user_${userId}`).emit("payment_request_updated", eventData);
      io.to(`user_${request.senderId}`).emit("payment_request_updated", eventData);

      // Also emit money_received so the requester gets a push notification
      io.to(`user_${request.senderId}`).emit("money_received", {
        amount,
        currency: request.currency || "RWF",
        from: payerName,
        transactionId: transactionRecord.id,
        referenceId,
        chatId: chatId || null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment request accepted and paid successfully",
      data: {
        requestId: request.id,
        transactionId: transactionRecord.id,
        referenceId,
        amount,
        currency: request.currency || "RWF",
      },
    });
  } catch (error) {
    await dbTransaction.rollback();
    console.error("Accept payment request error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Decline a received payment request
const declinePaymentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { chatId } = req.body;
    const userId = req.user.id;

    const request = await PaymentRequest.findByPk(id as string);
    if (!request) {
      res.status(404).json({
        success: false,
        message: "Payment request not found",
      });
      return;
    }

    if (request.recipientId !== userId) {
      res.status(403).json({
        success: false,
        message: "Only the recipient can decline this request",
      });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({
        success: false,
        message: "Only pending requests can be declined",
      });
      return;
    }

    await request.update({ status: "cancelled" });

    // Update the ChatMessage content in DB so fresh loads reflect the cancelled status
    if (chatId) {
      try {
        const chatMessages = await (database_models.ChatMessage as any).findAll({
          where: { chatId, messageType: "money" },
        });
        for (const chatMsg of chatMessages) {
          try {
            const parsed = JSON.parse(chatMsg.content);
            if (parsed?.type === "money_request" && parsed?.requestId === (id as string)) {
              await chatMsg.update({
                content: JSON.stringify({ ...parsed, status: "cancelled" }),
              });
              break;
            }
          } catch {
            // skip
          }
        }
      } catch {
        // Non-critical
      }
    }

    // Notify sender that recipient declined
    const recipient = await User.findByPk(userId);
    const recipientName = recipient
      ? `${recipient.firstName} ${recipient.lastName}`
      : "Recipient";

    await notifyPaymentRequestDeclined(
      req.app,
      request.senderId,
      request.id,
      Number(request.amount),
      request.currency,
      recipientName,
    );

    // Emit real-time socket event so both parties' cards update instantly
    const io = req.app.get("io");
    if (io) {
      const eventData = {
        requestId: request.id,
        status: "cancelled",
        chatId: chatId || null,
        recipientName,
      };
      io.to(`user_${userId}`).emit("payment_request_updated", eventData);
      io.to(`user_${request.senderId}`).emit("payment_request_updated", eventData);
    }

    res.status(200).json({
      success: true,
      message: "Payment request declined successfully",
      data: request,
    });
  } catch (error) {
    console.error("Decline payment request error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Generate a QR code image for a payment request
const getPaymentRequestQR = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await PaymentRequest.findByPk(id as string, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    if (!request) {
      res.status(404).json({ success: false, message: "Payment request not found" });
      return;
    }

    if (request.senderId !== userId) {
      res.status(403).json({ success: false, message: "Only the requester can generate a QR code" });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({ success: false, message: "QR code can only be generated for pending requests" });
      return;
    }

    const QRCode = await import("qrcode");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
    const deepLink = `${frontendUrl}/home/transfer/amount?requestId=${id}`;

    const qrDataUrl = await QRCode.default.toDataURL(deepLink, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const sender = (request as any).sender;
    res.status(200).json({
      success: true,
      data: {
        qrCode: qrDataUrl,
        deepLink,
        requestId: id,
        amount: request.amount,
        currency: request.currency,
        note: request.note,
        allowEditAmount: request.allowEditAmount,
        senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() : "Unknown",
      },
    });
  } catch (error) {
    console.error("Get payment request QR error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default {
  transferMoney,
  getWalletBalance,
  getTransactionHistory,
  getTransactionDetails,
  createPaymentRequest,
  getUserPaymentRequests,
  getPaymentRequestById,
  getPaymentRequestQR,
  acceptPaymentRequest,
  declinePaymentRequest,
  getAllWallets,
  getAllRestrictions,
  createRestriction,
  updateRestriction,
  deleteRestriction,
  getUserWallet,
  getOrganizationWallet,
  getTransactionCategories,
  getWalletRestrictions,
  getWalletBalanceBreakdown,
  getRecentSends,
  getContactStats,
  getAllTransactions,
  getTransactionById,
};
