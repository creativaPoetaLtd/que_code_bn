import { Application } from "express";
import { Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { getAvailableBalance } from "../utils/walletBalance";
import { resolveWalletWhere, validateFundsAvailability } from "../utils/transferValidation";
import { computeNextRun, isRecurrenceExhausted } from "../utils/recurrence";
import {
  notifyScheduledTransferHeld,
  notifyScheduledTransferHoldFailed,
  notifyScheduledTransferExecuted,
  notifyScheduledTransferFailed,
  notifyScheduledSeriesAutoPaused,
  notifyPaymentReceived,
} from "../utils/notificationHelpers";

const {
  sequelize,
  Wallet,
  Transaction: TransactionModel,
  Category,
  WalletRestriction,
  ScheduledTransfer,
  User,
  Organization,
} = database_models as any;

export const MAX_CONSECUTIVE_FAILURES = 3;
export const ROLLING_HOLD_WINDOW_HOURS = 24;
export const STALE_EXECUTING_MINUTES = 5;

const identityWhere = (st: any, side: "sender" | "receiver") =>
  side === "sender"
    ? resolveWalletWhere({
        userId: st.senderUserId,
        organizationId: st.senderOrganizationId,
        subActionId: st.senderSubActionId,
      })
    : resolveWalletWhere({
        userId: st.receiverUserId,
        organizationId: st.receiverOrganizationId,
        walletId: st.receiverWalletId,
      });

const resolveName = async (identity: {
  userId?: string | null;
  organizationId?: string | null;
}): Promise<string> => {
  if (identity.userId) {
    const user = await User.findByPk(identity.userId);
    return user ? `${user.firstName} ${user.lastName}` : "A user";
  }
  if (identity.organizationId) {
    const org = await Organization.findByPk(identity.organizationId);
    return org ? org.name : "An organization";
  }
  return "A user";
};

/**
 * Locks the sender wallet, validates funds (respecting existing holds and category
 * restrictions), and reserves amount+fee against heldBalance if there's room.
 * Caller is responsible for persisting the resulting status on the ScheduledTransfer row.
 */
export const placeHoldForOccurrence = async (
  scheduledTransfer: any,
  dbTransaction: DbTransaction
): Promise<{ ok: boolean; message?: string; heldAmount?: number }> => {
  const senderWhere = identityWhere(scheduledTransfer, "sender");
  const receiverWhere = identityWhere(scheduledTransfer, "receiver");
  if (!senderWhere || !receiverWhere) {
    return { ok: false, message: "Invalid sender or receiver on scheduled transfer" };
  }

  const [senderWallet, receiverWallet] = await Promise.all([
    Wallet.findOne({ where: senderWhere, lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
    Wallet.findOne({ where: receiverWhere, transaction: dbTransaction }),
  ]);

  if (!senderWallet) return { ok: false, message: "Sender wallet not found or inactive" };
  if (!receiverWallet) return { ok: false, message: "Receiver wallet not found or inactive" };

  const transferAmount = parseFloat(scheduledTransfer.amount.toString());
  const fee = parseFloat((scheduledTransfer.fee ?? 0).toString());
  const totalAmount = transferAmount + fee;
  const receiverIsUser = !!receiverWallet.userId;

  const restrictions = await WalletRestriction.findAll({
    where: { walletId: senderWallet.id },
    include: [{ model: Category, as: "category", required: true }],
    transaction: dbTransaction,
  });

  const result = validateFundsAvailability({
    availableBalance: getAvailableBalance(senderWallet),
    restrictions,
    transferAmount: totalAmount,
    receiverIsUser,
    categoryId: scheduledTransfer.categoryId,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await senderWallet.update(
    { heldBalance: parseFloat(senderWallet.heldBalance.toString()) + totalAmount },
    { transaction: dbTransaction }
  );

  return { ok: true, heldAmount: totalAmount };
};

export const releaseHoldForOccurrence = async (scheduledTransfer: any, dbTransaction: DbTransaction) => {
  if (!scheduledTransfer.heldAmount) return;

  const senderWhere = identityWhere(scheduledTransfer, "sender");
  if (!senderWhere) return;

  const senderWallet = await Wallet.findOne({
    where: senderWhere,
    lock: dbTransaction.LOCK.UPDATE,
    transaction: dbTransaction,
  });
  if (!senderWallet) return;

  const currentHeld = parseFloat(senderWallet.heldBalance.toString());
  const releaseAmount = parseFloat(scheduledTransfer.heldAmount.toString());
  await senderWallet.update(
    { heldBalance: Math.max(0, currentHeld - releaseAmount) },
    { transaction: dbTransaction }
  );
};

/**
 * Called by the rolling-hold job for a recurring series whose next occurrence is
 * approaching but not yet due. Never changes scheduledFor - a failure here just means
 * "try again next hour", up until the occurrence is actually due.
 */
export const attemptHold = async (app: Application, scheduledTransferId: string): Promise<void> => {
  const st = await ScheduledTransfer.findByPk(scheduledTransferId);
  if (!st || st.status !== "scheduled") return;

  type HoldOutcome = { ok: boolean; message?: string; heldAmount?: number };

  const outcome: HoldOutcome | null = await sequelize.transaction(async (t: DbTransaction) => {
    const locked = await ScheduledTransfer.findByPk(scheduledTransferId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!locked || locked.status !== "scheduled") return null;

    const holdOutcome: HoldOutcome = await placeHoldForOccurrence(locked, t);

    if (holdOutcome.ok) {
      await locked.update(
        {
          status: "held",
          heldAmount: holdOutcome.heldAmount,
          heldAt: new Date(),
          consecutiveFailureCount: 0,
          lastFailureReason: null,
        },
        { transaction: t }
      );
    } else {
      const consecutiveFailureCount = (locked.consecutiveFailureCount || 0) + 1;
      const shouldPause = consecutiveFailureCount >= MAX_CONSECUTIVE_FAILURES;
      await locked.update(
        {
          consecutiveFailureCount,
          lastFailureReason: holdOutcome.message,
          status: shouldPause ? "paused" : "scheduled",
        },
        { transaction: t }
      );
    }

    return holdOutcome;
  });

  if (!outcome) return;

  const fresh = await ScheduledTransfer.findByPk(scheduledTransferId);
  if (!fresh) return;

  if (outcome.ok) {
    await notifyScheduledTransferHeld(app, fresh.createdByUserId, fresh.id, fresh.amount, fresh.currency, fresh.scheduledFor);
  } else if (fresh.status === "paused") {
    await notifyScheduledSeriesAutoPaused(app, fresh.createdByUserId, fresh.id, fresh.lastFailureReason || "Repeated failures reserving funds");
  } else {
    await notifyScheduledTransferHoldFailed(app, fresh.createdByUserId, fresh.id, fresh.amount, fresh.currency, outcome.message || "Insufficient funds");
  }
};

/**
 * An occurrence definitively did not happen (hard execution failure, or it went past
 * its due date without ever being held). Releases any hold, then either ends the series
 * (one-time / paused-out recurring) or rolls it forward to the next occurrence.
 */
export const finalizeFailedOccurrence = async (
  app: Application,
  scheduledTransferId: string,
  reason: string
): Promise<void> => {
  let resultStatus = "";

  await sequelize.transaction(async (t: DbTransaction) => {
    const st = await ScheduledTransfer.findByPk(scheduledTransferId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!st || ["completed", "cancelled", "failed"].includes(st.status)) return;

    await releaseHoldForOccurrence(st, t);

    const consecutiveFailureCount = (st.consecutiveFailureCount || 0) + 1;
    const isRecurring = !!st.recurrenceRule;

    if (!isRecurring) {
      resultStatus = "failed";
      await st.update(
        { status: "failed", consecutiveFailureCount, lastFailureReason: reason, heldAmount: null, heldAt: null },
        { transaction: t }
      );
      return;
    }

    if (consecutiveFailureCount >= MAX_CONSECUTIVE_FAILURES) {
      resultStatus = "paused";
      await st.update(
        { status: "paused", consecutiveFailureCount, lastFailureReason: reason, heldAmount: null, heldAt: null },
        { transaction: t }
      );
      return;
    }

    const nextRun = computeNextRun(st.scheduledFor, st.timezone, st.recurrenceRule);
    if (isRecurrenceExhausted(st.recurrenceRule, st.occurrenceCount, nextRun)) {
      resultStatus = "completed";
      await st.update(
        { status: "completed", consecutiveFailureCount, lastFailureReason: reason, heldAmount: null, heldAt: null },
        { transaction: t }
      );
      return;
    }

    resultStatus = "scheduled";
    await st.update(
      {
        status: "scheduled",
        scheduledFor: nextRun,
        consecutiveFailureCount,
        lastFailureReason: reason,
        heldAmount: null,
        heldAt: null,
      },
      { transaction: t }
    );
  });

  const fresh = await ScheduledTransfer.findByPk(scheduledTransferId);
  if (!fresh) return;

  if (resultStatus === "paused") {
    await notifyScheduledSeriesAutoPaused(app, fresh.createdByUserId, fresh.id, reason);
  } else {
    await notifyScheduledTransferFailed(app, fresh.createdByUserId, fresh.id, fresh.amount, fresh.currency, reason);
  }
};

/**
 * Executes a due, already-held occurrence: moves the money, writes the ledger entry,
 * and either closes the series out or rolls it forward. Idempotent via idempotencyKey -
 * safe to call again for a row still sitting in 'executing' after a crash, since the
 * ledger write and status advance happen in the same DB transaction.
 */
export const executeOccurrence = async (app: Application, scheduledTransferId: string): Promise<void> => {
  let outcome: "completed" | "rolled" | "failed" | "skipped" = "skipped";
  let executedTransactionId: string | null = null;
  let executedAmount = 0;
  let executedCurrency = "RWF";
  let receiverName = "";
  let senderName = "";
  let receiverUserId: string | null = null;
  let failureReason: string | null = null;

  try {
    await sequelize.transaction(async (t: DbTransaction) => {
      const st = await ScheduledTransfer.findByPk(scheduledTransferId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!st || st.status !== "executing") return;

      const senderWhere = identityWhere(st, "sender");
      const receiverWhere = identityWhere(st, "receiver");
      if (!senderWhere || !receiverWhere) {
        failureReason = "Invalid sender or receiver on scheduled transfer";
        return;
      }

      const [senderWallet, receiverWallet] = await Promise.all([
        Wallet.findOne({ where: senderWhere, lock: t.LOCK.UPDATE, transaction: t }),
        Wallet.findOne({ where: receiverWhere, lock: t.LOCK.UPDATE, transaction: t }),
      ]);

      if (!senderWallet) {
        failureReason = "Sender wallet not found or inactive";
        return;
      }
      if (!receiverWallet) {
        failureReason = "Receiver wallet not found or inactive";
        return;
      }

      const heldAmount = parseFloat((st.heldAmount ?? 0).toString());
      const transferAmount = parseFloat(st.amount.toString());
      const fee = parseFloat((st.fee ?? 0).toString());

      // Defensive: funds were reserved at hold time, so this should never trip in practice.
      if (parseFloat(senderWallet.balance.toString()) < heldAmount) {
        failureReason = "Reserved funds are no longer available in the sender wallet";
        return;
      }

      const receiverIsUser = !!receiverWallet.userId;

      await senderWallet.update(
        {
          balance: parseFloat(senderWallet.balance.toString()) - heldAmount,
          heldBalance: Math.max(0, parseFloat(senderWallet.heldBalance.toString()) - heldAmount),
        },
        { transaction: t }
      );
      await receiverWallet.update(
        { balance: parseFloat(receiverWallet.balance.toString()) + transferAmount },
        { transaction: t }
      );

      const spendConstraintType = st.applyConstraints && st.categoryId ? "category" : "none";
      const constraintCategoryId = st.applyConstraints && st.categoryId ? st.categoryId : null;

      const newTransaction = await TransactionModel.create(
        {
          referenceId: st.idempotencyKey,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: transferAmount,
          fee,
          totalAmount: heldAmount,
          currency: st.currency,
          status: "completed",
          type: st.type,
          description: st.description,
          categoryId: st.categoryId,
          spendConstraintType,
          constraintCategoryId,
          hasAccount: true,
          scheduledTransferId: st.id,
        } as any,
        { transaction: t }
      );

      if (st.applyConstraints && st.categoryId) {
        const existingRestriction = await WalletRestriction.findOne({
          where: { walletId: receiverWallet.id, categoryId: st.categoryId },
          transaction: t,
        });
        if (existingRestriction) {
          await existingRestriction.update(
            { amount: parseFloat(existingRestriction.amount.toString()) + transferAmount },
            { transaction: t }
          );
        } else {
          await WalletRestriction.create(
            { walletId: receiverWallet.id, categoryId: st.categoryId, amount: transferAmount },
            { transaction: t }
          );
        }
      } else if (st.categoryId && !receiverIsUser) {
        const restrictions = await WalletRestriction.findAll({
          where: { walletId: senderWallet.id },
          transaction: t,
        });
        const matching = restrictions.find((r: any) => r.categoryId === st.categoryId);
        if (matching) {
          const restrictedAvailable = parseFloat(matching.amount.toString());
          const reduceBy = Math.min(restrictedAvailable, transferAmount);
          const newAmount = restrictedAvailable - reduceBy;
          if (newAmount <= 0) {
            await matching.destroy({ transaction: t });
          } else {
            await matching.update({ amount: newAmount }, { transaction: t });
          }
        }
      }

      const occurrenceCount = (st.occurrenceCount || 0) + 1;
      executedTransactionId = newTransaction.id;
      executedAmount = transferAmount;
      executedCurrency = st.currency;
      receiverUserId = st.receiverUserId;

      if (!st.recurrenceRule) {
        outcome = "completed";
        await st.update(
          {
            status: "completed",
            occurrenceCount,
            lastExecutedTransactionId: newTransaction.id,
            consecutiveFailureCount: 0,
            heldAmount: null,
            heldAt: null,
          },
          { transaction: t }
        );
        return;
      }

      const nextRun = computeNextRun(st.scheduledFor, st.timezone, st.recurrenceRule);
      if (isRecurrenceExhausted(st.recurrenceRule, occurrenceCount, nextRun)) {
        outcome = "completed";
        await st.update(
          {
            status: "completed",
            occurrenceCount,
            lastExecutedTransactionId: newTransaction.id,
            consecutiveFailureCount: 0,
            heldAmount: null,
            heldAt: null,
          },
          { transaction: t }
        );
        return;
      }

      outcome = "rolled";
      const nextIdempotencyKey = `${st.id}:${occurrenceCount}`;
      const withinWindow = nextRun.getTime() - Date.now() <= ROLLING_HOLD_WINDOW_HOURS * 60 * 60 * 1000;

      let nextStatus: "held" | "scheduled" = "scheduled";
      let nextHeldAmount: number | null = null;
      let nextHeldAt: Date | null = null;

      if (withinWindow) {
        const draft = { ...st.toJSON(), scheduledFor: nextRun };
        const holdResult = await placeHoldForOccurrence(draft, t);
        if (holdResult.ok) {
          nextStatus = "held";
          nextHeldAmount = holdResult.heldAmount ?? null;
          nextHeldAt = new Date();
        }
      }

      await st.update(
        {
          status: nextStatus,
          occurrenceCount,
          scheduledFor: nextRun,
          idempotencyKey: nextIdempotencyKey,
          lastExecutedTransactionId: newTransaction.id,
          consecutiveFailureCount: 0,
          heldAmount: nextHeldAmount,
          heldAt: nextHeldAt,
        },
        { transaction: t }
      );
    });
  } catch (error) {
    console.error(`Scheduled transfer execution error (${scheduledTransferId}):`, error);
    failureReason = "Internal error while executing the transfer";
  }

  if (failureReason) {
    await finalizeFailedOccurrence(app, scheduledTransferId, failureReason);
    return;
  }

  if (outcome === "skipped" || !executedTransactionId) return;

  const fresh = await ScheduledTransfer.findByPk(scheduledTransferId);
  if (!fresh) return;

  senderName = await resolveName({ userId: fresh.senderUserId, organizationId: fresh.senderOrganizationId });
  receiverName = await resolveName({ userId: fresh.receiverUserId, organizationId: fresh.receiverOrganizationId });

  await notifyScheduledTransferExecuted(
    app,
    fresh.createdByUserId,
    executedTransactionId,
    executedAmount,
    executedCurrency,
    receiverName
  );

  if (receiverUserId) {
    await notifyPaymentReceived(app, receiverUserId, executedTransactionId, executedAmount, executedCurrency, senderName);
  }
};
