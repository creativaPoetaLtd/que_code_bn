import { Response } from "express";
import * as bcrypt from "bcrypt";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { getAvailableBalance } from "../utils/walletBalance";
import { resolveWalletWhere, validateFundsAvailability } from "../utils/transferValidation";
import { notifyPaymentReceived, notifyBatchTransferCompleted } from "../utils/notificationHelpers";

const {
  Wallet,
  Transaction: TransactionModel,
  Category,
  WalletRestriction,
  User,
  Organization,
  SubAction,
  Action,
  TransferBatch,
} = database_models as any;

const MAX_BATCH_RECIPIENTS = 100;

interface RecipientInput {
  receiverUserId?: string;
  receiverOrganizationId?: string;
  receiverWalletId?: string;
  amount: number | string;
  description?: string;
}

const buildBatchResponse = (batch: any, transactions: any[]) => {
  const successResults = transactions.map((t: any) => ({
    status: "success",
    transactionId: t.id,
    receiverWalletId: t.receiverWalletId,
    amount: parseFloat(t.amount.toString()),
  }));
  const failureResults = (batch.failures || []).map((f: any) => ({ ...f, status: "failed" }));

  return {
    batchId: batch.id,
    status: batch.status,
    recipientCount: batch.recipientCount,
    successCount: batch.successCount,
    failureCount: batch.failureCount,
    totalRequestedAmount: parseFloat(batch.totalRequestedAmount.toString()),
    totalSentAmount: parseFloat(batch.totalSentAmount.toString()),
    totalFailedAmount: parseFloat(batch.totalFailedAmount.toString()),
    results: [...successResults, ...failureResults],
  };
};

/**
 * Sends money to multiple recipients in one request. Validates the batch total up front
 * (fail fast if it's unaffordable as a whole), then processes each recipient independently
 * inside a single locked sender-wallet transaction: a recipient that fails validation is
 * skipped with a reason, it never touches the sender's balance, and the rest of the batch
 * still goes through. Mirrors transferMoney's PIN/ownership/restriction rules exactly, since
 * this is the same money-movement operation just run for a list instead of one recipient.
 */
export const createBatchTransfer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const dbTransaction = await TransactionModel.sequelize?.transaction();

  try {
    const {
      senderUserId,
      senderOrganizationId,
      senderSubActionId,
      recipients,
      description = "",
      categoryId,
      type = "transfer",
      applyConstraints = false,
      pin,
      idempotencyKey,
    } = req.body as {
      senderUserId?: string;
      senderOrganizationId?: string;
      senderSubActionId?: string;
      recipients: RecipientInput[];
      description?: string;
      categoryId?: string;
      type?: string;
      applyConstraints?: boolean;
      pin?: string;
      idempotencyKey?: string;
    };

    const senderTargets = [senderUserId, senderOrganizationId, senderSubActionId].filter(Boolean).length;
    if (senderTargets !== 1) {
      await dbTransaction?.rollback();
      res.status(400).json({
        success: false,
        message: "Exactly one sender (user, organization, or sub-action) is required",
      });
      return;
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      await dbTransaction?.rollback();
      res.status(400).json({ success: false, message: "At least one recipient is required" });
      return;
    }

    if (recipients.length > MAX_BATCH_RECIPIENTS) {
      await dbTransaction?.rollback();
      res.status(400).json({
        success: false,
        message: `A batch can contain at most ${MAX_BATCH_RECIPIENTS} recipients`,
      });
      return;
    }

    for (const r of recipients) {
      const recipientTargets = [r.receiverUserId, r.receiverOrganizationId, r.receiverWalletId].filter(
        Boolean
      ).length;
      if (recipientTargets !== 1 || !r.amount || Number(r.amount) <= 0) {
        await dbTransaction?.rollback();
        res.status(400).json({
          success: false,
          message: "Each recipient needs exactly one receiver target and an amount greater than 0",
        });
        return;
      }
    }

    const authenticatedUserId = req.user.id;
    const authUser = (req as unknown as AuthRequest).user;
    const requesterOrganizationId =
      authUser?.accountType === "organization" ? authUser.id : authUser?.organizationId || null;

    if (senderUserId && senderUserId !== authenticatedUserId) {
      await dbTransaction?.rollback();
      res.status(403).json({ success: false, message: "You can only send money from your own account" });
      return;
    }

    if (senderOrganizationId) {
      if (!requesterOrganizationId || senderOrganizationId !== requesterOrganizationId) {
        await dbTransaction?.rollback();
        res.status(403).json({
          success: false,
          message: "You are not authorized to send money from this organization",
        });
        return;
      }
    }

    if (senderSubActionId) {
      if (!requesterOrganizationId) {
        await dbTransaction?.rollback();
        res.status(403).json({
          success: false,
          message: "Organization context is required to send from a sub-action wallet",
        });
        return;
      }
      const subActionRecord: any = await SubAction.findByPk(senderSubActionId, {
        include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
      });
      if (!subActionRecord) {
        await dbTransaction?.rollback();
        res.status(404).json({ success: false, message: "Sender sub-action not found" });
        return;
      }
      const ownerOrganizationId = subActionRecord.action?.organizationId;
      if (!ownerOrganizationId || ownerOrganizationId !== requesterOrganizationId) {
        await dbTransaction?.rollback();
        res.status(403).json({
          success: false,
          message: "You are not authorized to send money from this sub-action wallet",
        });
        return;
      }
    }

    for (const r of recipients) {
      if (
        (senderUserId && r.receiverUserId && senderUserId === r.receiverUserId) ||
        (senderOrganizationId && r.receiverOrganizationId && senderOrganizationId === r.receiverOrganizationId)
      ) {
        await dbTransaction?.rollback();
        res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
        return;
      }
    }

    // PIN verification (mirrors transferMoney's flow exactly, since this is the same
    // authorization gate for the same kind of money-moving action)
    if (senderUserId) {
      const authenticatedUser = await User.findByPk(authenticatedUserId);
      if (!authenticatedUser) {
        await dbTransaction?.rollback();
        res.status(404).json({ success: false, message: "Authenticated user not found" });
        return;
      }

      if (!authenticatedUser.hasPinSet) {
        await dbTransaction?.rollback();
        res.status(403).json({
          success: false,
          message: "PIN not set up. Please set up your transaction PIN before making transfers.",
          requiresPinSetup: true,
        });
        return;
      }

      if (!pin) {
        await dbTransaction?.rollback();
        res.status(400).json({ success: false, message: "PIN is required for transactions" });
        return;
      }

      if (!/^\d{4}$/.test(pin)) {
        await dbTransaction?.rollback();
        res.status(400).json({ success: false, message: "PIN must be exactly 4 digits" });
        return;
      }

      if (authenticatedUser.pinLockedUntil && authenticatedUser.pinLockedUntil > new Date()) {
        const remainingTime = Math.ceil(
          (authenticatedUser.pinLockedUntil.getTime() - Date.now()) / 60000
        );
        await dbTransaction?.rollback();
        res.status(429).json({
          success: false,
          message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
          lockedUntil: authenticatedUser.pinLockedUntil,
          remainingMinutes: remainingTime,
        });
        return;
      }

      const isValidPin = await bcrypt.compare(pin, authenticatedUser.transactionPin!);
      if (!isValidPin) {
        const newAttempts = (authenticatedUser.pinAttempts || 0) + 1;
        const maxAttempts = 3;
        const lockoutMinutes = 15;
        const updateData: any = { pinAttempts: newAttempts };

        if (newAttempts >= maxAttempts) {
          const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
          updateData.pinLockedUntil = lockedUntil;
          await authenticatedUser.update(updateData);

          try {
            const sendEmailFn = require("../helpers/email").default;
            await sendEmailFn({
              to: authenticatedUser.email,
              subject: "Account Locked - PIN Reset Required",
              type: "account_blocked",
              data: {
                name: authenticatedUser.firstName,
                lockoutMinutes: lockoutMinutes.toString(),
                resetUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/security?tab=pin-reset`,
              },
            });
          } catch (emailError) {
            console.error("Failed to send account blocked email:", emailError);
          }

          await dbTransaction?.rollback();
          res.status(429).json({
            success: false,
            message: "Account locked due to too many failed PIN attempts. Please reset your PIN to regain access.",
            attemptsRemaining: 0,
            lockedUntil,
            remainingMinutes: lockoutMinutes,
          });
          return;
        }

        await authenticatedUser.update(updateData);
        await dbTransaction?.rollback();
        res.status(400).json({
          success: false,
          message: `Invalid PIN. ${maxAttempts - newAttempts} attempts remaining.`,
          attemptsRemaining: maxAttempts - newAttempts,
        });
        return;
      }

      await authenticatedUser.update({ pinAttempts: 0, pinLockedUntil: null });
    }

    // Idempotency: a repeated submission with the same key returns the original result
    // instead of processing (and potentially double-paying) the batch again.
    if (idempotencyKey) {
      const existing = await TransferBatch.findOne({
        where: { createdByUserId: authenticatedUserId, idempotencyKey },
      });
      if (existing) {
        await dbTransaction?.rollback();
        const existingTransactions = await TransactionModel.findAll({ where: { batchId: existing.id } });
        res.status(200).json({
          success: true,
          message: "Batch already processed",
          data: buildBatchResponse(existing, existingTransactions),
        });
        return;
      }
    }

    const senderWhere = resolveWalletWhere({
      userId: senderUserId,
      organizationId: senderOrganizationId,
      subActionId: senderSubActionId,
    });
    const senderWallet = await Wallet.findOne({
      where: senderWhere as any,
      lock: dbTransaction?.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!senderWallet) {
      await dbTransaction?.rollback();
      res.status(404).json({ success: false, message: "Sender wallet not found or inactive" });
      return;
    }

    // Fast fail: reject the whole batch up front if it's unaffordable in aggregate,
    // rather than letting every recipient fail one-by-one.
    const totalRequestedAmount = recipients.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
    if (getAvailableBalance(senderWallet) < totalRequestedAmount) {
      await dbTransaction?.rollback();
      res.status(400).json({
        success: false,
        message: `Insufficient balance for this batch. Available: ${getAvailableBalance(senderWallet)}, Required: ${totalRequestedAmount}`,
      });
      return;
    }

    const batch = await TransferBatch.create(
      {
        createdByUserId: authenticatedUserId,
        senderUserId: senderUserId || null,
        senderOrganizationId: senderOrganizationId || null,
        senderSubActionId: senderSubActionId || null,
        currency: senderWallet.currency,
        type,
        description,
        categoryId: categoryId || null,
        applyConstraints,
        idempotencyKey: idempotencyKey || null,
        recipientCount: recipients.length,
        totalRequestedAmount,
      } as any,
      { transaction: dbTransaction }
    );

    const results: any[] = [];
    const failures: any[] = [];
    let totalSent = 0;
    let successCount = 0;

    for (const recipient of recipients) {
      const recipientIdentity = {
        receiverUserId: recipient.receiverUserId || null,
        receiverOrganizationId: recipient.receiverOrganizationId || null,
        receiverWalletId: recipient.receiverWalletId || null,
      };
      const transferAmount = parseFloat(recipient.amount.toString());

      const receiverWhere = resolveWalletWhere({
        userId: recipient.receiverUserId,
        organizationId: recipient.receiverOrganizationId,
        walletId: recipient.receiverWalletId,
      });

      const receiverWallet = await Wallet.findOne({
        where: receiverWhere as any,
        lock: dbTransaction?.LOCK.UPDATE,
        transaction: dbTransaction,
      });

      if (!receiverWallet) {
        const reason = "Receiver wallet not found or inactive";
        failures.push({ ...recipientIdentity, amount: transferAmount, reason });
        results.push({ ...recipientIdentity, amount: transferAmount, status: "failed", reason });
        continue;
      }

      if (receiverWallet.id === senderWallet.id) {
        const reason = "Cannot transfer to the same wallet";
        failures.push({ ...recipientIdentity, amount: transferAmount, reason });
        results.push({ ...recipientIdentity, amount: transferAmount, status: "failed", reason });
        continue;
      }

      // Re-read the sender's live balance/restrictions each iteration, since prior
      // recipients in this same loop may have already consumed some of it.
      await senderWallet.reload({ transaction: dbTransaction });
      const restrictions = await WalletRestriction.findAll({
        where: { walletId: senderWallet.id },
        include: [{ model: Category, as: "category", required: true }],
        transaction: dbTransaction,
      });

      const receiverIsUser = !!receiverWallet.userId;
      const validation = validateFundsAvailability({
        availableBalance: getAvailableBalance(senderWallet),
        restrictions: restrictions as any,
        transferAmount,
        receiverIsUser,
        categoryId,
      });

      if (!validation.ok) {
        const reason = validation.message || "Insufficient balance";
        failures.push({ ...recipientIdentity, amount: transferAmount, reason });
        results.push({ ...recipientIdentity, amount: transferAmount, status: "failed", reason });
        continue;
      }

      await senderWallet.decrement("balance", { by: transferAmount, transaction: dbTransaction });
      await receiverWallet.increment("balance", { by: transferAmount, transaction: dbTransaction });
      await senderWallet.reload({ transaction: dbTransaction });

      const spendConstraintType = applyConstraints && categoryId ? "category" : "none";
      const constraintCategoryId = applyConstraints && categoryId ? categoryId : null;
      const referenceId = `BATCH${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const newTransaction = await TransactionModel.create(
        {
          referenceId,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: transferAmount,
          fee: 0,
          totalAmount: transferAmount,
          currency: senderWallet.currency,
          status: "completed",
          type,
          description: recipient.description || description,
          categoryId: categoryId || undefined,
          spendConstraintType,
          constraintCategoryId,
          hasAccount: true,
          batchId: batch.id,
        } as any,
        { transaction: dbTransaction }
      );

      // Same restriction bookkeeping transferMoney does for a single send.
      if (applyConstraints && categoryId) {
        const existingRestriction = await WalletRestriction.findOne({
          where: { walletId: receiverWallet.id, categoryId },
          transaction: dbTransaction,
        });
        if (existingRestriction) {
          await existingRestriction.update(
            { amount: parseFloat(existingRestriction.amount.toString()) + transferAmount },
            { transaction: dbTransaction }
          );
        } else {
          await WalletRestriction.create(
            { walletId: receiverWallet.id, categoryId, amount: transferAmount },
            { transaction: dbTransaction }
          );
        }
      } else if (categoryId && !receiverIsUser) {
        const matching = restrictions.find((r: any) => r.categoryId === categoryId);
        if (matching) {
          const restrictedAvailable = parseFloat((matching as any).amount.toString());
          const reduceBy = Math.min(restrictedAvailable, transferAmount);
          const newAmount = restrictedAvailable - reduceBy;
          if (newAmount <= 0) {
            await (matching as any).destroy({ transaction: dbTransaction });
          } else {
            await (matching as any).update({ amount: newAmount }, { transaction: dbTransaction });
          }
        }
      }

      totalSent += transferAmount;
      successCount += 1;
      results.push({ ...recipientIdentity, amount: transferAmount, status: "success", transactionId: newTransaction.id });
    }

    const failureCount = recipients.length - successCount;
    const totalFailedAmount = failures.reduce((sum, f) => sum + f.amount, 0);
    const status = successCount === 0 ? "failed" : failureCount > 0 ? "partial" : "completed";

    await batch.update(
      {
        totalSentAmount: totalSent,
        totalFailedAmount,
        successCount,
        failureCount,
        status,
        failures: failures.length > 0 ? failures : null,
      },
      { transaction: dbTransaction }
    );

    await dbTransaction?.commit();

    try {
      let senderName = "A user";
      if (senderUserId) {
        const sender = await User.findByPk(senderUserId);
        senderName = sender ? `${sender.firstName} ${sender.lastName}` : senderName;
      } else if (senderOrganizationId) {
        const senderOrg = await Organization.findByPk(senderOrganizationId);
        senderName = senderOrg ? senderOrg.name : senderName;
      }

      if (senderUserId) {
        await notifyBatchTransferCompleted(
          req.app,
          senderUserId,
          batch.id,
          successCount,
          failureCount,
          totalSent,
          senderWallet.currency || "RWF"
        );
      }

      for (const result of results) {
        if (result.status === "success" && result.receiverUserId) {
          await notifyPaymentReceived(
            req.app,
            result.receiverUserId,
            result.transactionId,
            result.amount,
            senderWallet.currency || "RWF",
            senderName
          );
        }
      }
    } catch (notificationError) {
      console.error("Batch transfer notification error:", notificationError);
    }

    res.status(200).json({
      success: true,
      message: `Batch transfer processed: ${successCount} succeeded, ${failureCount} failed`,
      data: {
        batchId: batch.id,
        status,
        recipientCount: recipients.length,
        successCount,
        failureCount,
        totalRequestedAmount,
        totalSentAmount: totalSent,
        totalFailedAmount,
        results,
      },
    });
  } catch (error) {
    if (dbTransaction) {
      await dbTransaction.rollback();
    }
    console.error("Batch transfer error:", error);
    res.status(500).json({ success: false, message: "Internal server error during batch transfer" });
  }
};

export const getUserBatchTransfers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.user.id;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const { rows, count } = await TransferBatch.findAndCountAll({
      where: { createdByUserId: authenticatedUserId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: rows.map((b: any) => ({
        id: b.id,
        status: b.status,
        recipientCount: b.recipientCount,
        successCount: b.successCount,
        failureCount: b.failureCount,
        totalSentAmount: parseFloat(b.totalSentAmount.toString()),
        currency: b.currency,
        description: b.description,
        createdAt: b.createdAt,
      })),
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    console.error("Get user batch transfers error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getBatchTransferById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.user.id;
    const { id } = req.params;

    const batch = await TransferBatch.findByPk(id);
    if (!batch || batch.createdByUserId !== authenticatedUserId) {
      res.status(404).json({ success: false, message: "Batch not found" });
      return;
    }

    const transactions = await TransactionModel.findAll({
      where: { batchId: batch.id },
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json({ success: true, data: buildBatchResponse(batch, transactions) });
  } catch (error) {
    console.error("Get batch transfer by id error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
