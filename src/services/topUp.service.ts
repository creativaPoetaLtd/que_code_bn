// topUp.service.ts
// Wallet top-ups from mobile money. initiateTopUp() records a pending TopUp and asks the
// provider to collect; settleTopUp() is the single place that finishes one - it is
// idempotent, so a duplicate callback / late timer can never credit a wallet twice.
import { Application } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { TopUpProviderKey } from "../types/model";
import { createAndSendNotification } from "../utils/notificationService";
import { NotificationType } from "../utils/notificationConfig";
import { AccountRef } from "./accountTier.service";
import {
  TOPUP_PROVIDER_NAMES,
  TopUpResult,
  getTopUpProvider,
  normalizeRwandaPhone,
  phoneMatchesProvider,
} from "./topUpProviders";

const { sequelize, Wallet, TopUp, Transaction: TransactionModel } = database_models as any;

// Ownerless wallet recorded as the sender of every "topup" transaction (money that entered
// QC from outside). Its balance is never changed. Created by migration
// 20261112000000-add-top-ups.js - keep the id in sync.
export const EXTERNAL_FUNDS_WALLET_ID = "00000000-0000-4000-8000-0000000e0001";

export const MIN_TOPUP_AMOUNT = 100;
export const MAX_TOPUP_AMOUNT = 2000000;
export const TOPUP_PENDING_TIMEOUT_MINUTES = 15;
const DUPLICATE_WINDOW_MS = 60 * 1000;

export class TopUpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ownerWhere = (account: AccountRef) =>
  account.kind === "user" ? { userId: account.id } : { organizationId: account.id };

export const serializeTopUp = (topUp: any) => ({
  id: topUp.id,
  status: topUp.status,
  amount: parseFloat(topUp.amount.toString()),
  currency: topUp.currency,
  provider: topUp.provider,
  providerName: TOPUP_PROVIDER_NAMES[topUp.provider as TopUpProviderKey],
  phoneNumber: topUp.phoneNumber,
  note: topUp.note,
  simulated: topUp.simulated,
  providerReference: topUp.providerReference,
  failureReason: topUp.failureReason,
  transactionId: topUp.transactionId,
  completedAt: topUp.completedAt,
  createdAt: topUp.createdAt,
});

const notifyTopUp = async (app: Application, topUp: any): Promise<void> => {
  // Notifications are user-addressed; organizations have no notification inbox yet.
  if (!topUp.userId) return;
  const amount = parseFloat(topUp.amount.toString());
  const providerName = TOPUP_PROVIDER_NAMES[topUp.provider as TopUpProviderKey];
  const successful = topUp.status === "successful";
  try {
    await createAndSendNotification(app, {
      type: successful ? NotificationType.TOPUP_SUCCESSFUL : NotificationType.TOPUP_FAILED,
      recipientId: topUp.userId,
      data: {
        topUpId: topUp.id,
        transactionId: topUp.transactionId,
        amount,
        currency: topUp.currency,
        status: topUp.status,
        message: successful
          ? `${amount} ${topUp.currency} was added to your wallet from ${providerName}.`
          : `Your ${amount} ${topUp.currency} top-up from ${providerName} failed: ${topUp.failureReason}`,
        url: "/wallet",
      },
    } as any);
  } catch (error) {
    console.error("[topups] Notification failed:", error);
  }
};

/**
 * Finishes a pending top-up exactly once. Successful → wallet credited and a "topup"
 * transaction recorded; failed / expired → nothing moves. Returns the top-up, or null
 * when it was already settled (duplicate callback, late timer).
 */
export const settleTopUp = async (
  app: Application,
  topUpId: string,
  result: TopUpResult | { status: "expired"; reason: string }
): Promise<any | null> => {
  const settled = await sequelize.transaction(async (t: DbTransaction) => {
    const topUp = await TopUp.findByPk(topUpId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!topUp || topUp.status !== "pending") return null;

    if (result.status !== "successful") {
      await topUp.update(
        { status: result.status, failureReason: result.reason, completedAt: new Date() },
        { transaction: t }
      );
      return topUp;
    }

    // Credit even if the wallet was deactivated meanwhile: the payer's money has left
    // their mobile money account, so it must land somewhere visible.
    const wallet = await Wallet.findByPk(topUp.walletId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!wallet) throw new Error(`Wallet ${topUp.walletId} for top-up ${topUp.id} not found`);

    const amount = parseFloat(topUp.amount.toString());
    const providerName = TOPUP_PROVIDER_NAMES[topUp.provider as TopUpProviderKey];
    const providerReference = result.providerReference || topUp.providerReference;

    await wallet.increment("balance", { by: amount, transaction: t });

    const transaction = await TransactionModel.create(
      {
        referenceId: `TOPUP${Date.now()}${Math.floor(Math.random() * 1000)}`,
        senderWalletId: EXTERNAL_FUNDS_WALLET_ID,
        receiverWalletId: wallet.id,
        amount,
        fee: 0,
        totalAmount: amount,
        currency: topUp.currency,
        status: "completed",
        type: "topup",
        description: topUp.note || `Top-up from ${providerName}`,
        externalSenderName: providerName,
        externalSenderContact: topUp.phoneNumber,
        externalSenderProvider: topUp.provider,
        externalSenderReference: providerReference,
        hasAccount: true,
      } as any,
      { transaction: t }
    );

    await topUp.update(
      {
        status: "successful",
        providerReference,
        transactionId: transaction.id,
        completedAt: new Date(),
      },
      { transaction: t }
    );
    return topUp;
  });

  if (settled) await notifyTopUp(app, settled);
  return settled;
};

/**
 * Starts a top-up: validates, records it as pending and asks the provider to collect.
 * The wallet is credited later, when the provider reports success (settleTopUp).
 */
export const initiateTopUp = async (
  app: Application,
  account: AccountRef,
  input: { amount: unknown; provider: unknown; phoneNumber: unknown; note?: unknown }
): Promise<{ topUp: any; duplicate: boolean }> => {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
    throw new TopUpError(400, `Amount must be between ${MIN_TOPUP_AMOUNT} and ${MAX_TOPUP_AMOUNT} RWF`);
  }
  if (!Number.isInteger(amount)) throw new TopUpError(400, "Amount must be a whole number of RWF");

  if (input.provider !== "mtn_momo" && input.provider !== "airtel_money") {
    throw new TopUpError(400, "provider must be 'mtn_momo' or 'airtel_money'");
  }
  const providerKey = input.provider as TopUpProviderKey;

  const phoneNumber = normalizeRwandaPhone(input.phoneNumber);
  if (!phoneNumber) throw new TopUpError(400, "phoneNumber must be a valid Rwandan number (07XXXXXXXX)");
  if (!phoneMatchesProvider(phoneNumber, providerKey)) {
    throw new TopUpError(400, `${phoneNumber} is not a ${TOPUP_PROVIDER_NAMES[providerKey]} number`);
  }

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 250) : null;

  const provider = getTopUpProvider(providerKey);
  if (!provider) {
    throw new TopUpError(503, `Top-up with ${TOPUP_PROVIDER_NAMES[providerKey]} is not available yet`);
  }

  const wallet = await Wallet.findOne({ where: { ...ownerWhere(account), isActive: true } });
  if (!wallet) throw new TopUpError(404, "Wallet not found or inactive");

  // A double-tapped button must not send two payment prompts to the payer's phone.
  const recent = await TopUp.findOne({
    where: {
      walletId: wallet.id,
      amount,
      phoneNumber,
      provider: providerKey,
      status: "pending",
      createdAt: { [Op.gte]: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    order: [["createdAt", "DESC"]],
  });
  if (recent) return { topUp: recent, duplicate: true };

  const topUp = await TopUp.create({
    walletId: wallet.id,
    ...ownerWhere(account),
    amount,
    currency: wallet.currency || "RWF",
    provider: providerKey,
    phoneNumber,
    note,
    status: "pending",
    simulated: provider.simulated,
  });

  try {
    const { providerReference } = await provider.requestPayment(
      { topUpId: topUp.id, amount, currency: topUp.currency, phoneNumber, note },
      { settle: async (result) => void (await settleTopUp(app, topUp.id, result)) }
    );
    await topUp.update({ providerReference });
  } catch (error) {
    console.error(`[topups] Provider request failed for ${topUp.id}:`, error);
    await settleTopUp(app, topUp.id, { status: "failed", reason: "Mobile money provider rejected the request" });
    throw new TopUpError(502, "Mobile money provider is unavailable. Please try again.");
  }

  return { topUp, duplicate: false };
};

/** Fails top-ups the provider never answered (no callback, or a lost simulation timer). */
export const expireStaleTopUps = async (app: Application): Promise<number> => {
  const stale = await TopUp.findAll({
    where: {
      status: "pending",
      createdAt: { [Op.lt]: new Date(Date.now() - TOPUP_PENDING_TIMEOUT_MINUTES * 60 * 1000) },
    },
    attributes: ["id"],
    limit: 200,
  });

  let expired = 0;
  for (const { id } of stale) {
    try {
      const settled = await settleTopUp(app, id, {
        status: "expired",
        reason: `No answer from the payer within ${TOPUP_PENDING_TIMEOUT_MINUTES} minutes`,
      });
      if (settled) expired += 1;
    } catch (error) {
      console.error(`[topups] Expiry failed for ${id}:`, error);
    }
  }
  return expired;
};

export const findOwnTopUp = async (account: AccountRef, topUpId: string) => {
  const topUp = await TopUp.findOne({ where: { id: topUpId, ...ownerWhere(account) } });
  if (!topUp) throw new TopUpError(404, "Top-up not found");
  return topUp;
};

export const listOwnTopUps = async (account: AccountRef, page: number, limit: number) =>
  TopUp.findAndCountAll({
    where: ownerWhere(account),
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
