// accountTier.service.ts
// Runtime side of utils/accountTiers.ts: resolves an account's tier (+ admin grants),
// gates features, computes per-use fees, enforces the daily transfer limit and moves
// fee / plan money into the platform wallet. Every money path should go through
// quoteOutgoing() + creditPlatformFee() rather than re-reading TIERS directly.
import { Response } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { getAvailableBalance } from "../utils/walletBalance";
import {
  AccountTier,
  DEFAULT_ORGANIZATION_TIER,
  DEFAULT_USER_TIER,
  FEATURE_LABELS,
  FeatureAccess,
  FeatureKey,
  TIERS,
  feesEnabled,
  tiersForKind,
  transferLimitsEnabled,
} from "../utils/accountTiers";

const { User, Organization, SubAction, Action, Wallet, FeatureGrant, Transaction: TransactionModel } =
  database_models as any;

// Ownerless wallet that collects service fees and plan payments.
// Created by migration 20261111000000-add-account-tiers.js - keep the id in sync.
export const PLATFORM_WALLET_ID = "00000000-0000-4000-8000-00000000fee0";

export const DAILY_LIMIT_GRANT = "dailyTransferLimit";

// Rwanda has no DST, so the Kigali day is always UTC+2.
const KIGALI_UTC_OFFSET_MS = 2 * 60 * 60 * 1000;

export type AccountKind = "user" | "organization";

export interface AccountRef {
  kind: AccountKind;
  id: string;
}

export class TierError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Maps a TierError onto the response. Returns false for any other error. */
export const sendTierError = (res: Response, error: unknown): boolean => {
  if (!(error instanceof TierError)) return false;
  res.status(error.status).json({ success: false, code: error.code, message: error.message, ...error.details });
  return true;
};

interface AccountContext {
  account: AccountRef;
  tier: AccountTier;
  grants: any[];
}

export const loadAccountTier = async (account: AccountRef, t?: DbTransaction): Promise<AccountTier> => {
  if (account.kind === "user") {
    const user = await User.findByPk(account.id, { attributes: ["id", "accountTier"], transaction: t });
    return (user?.accountTier as AccountTier) || DEFAULT_USER_TIER;
  }
  const org = await Organization.findByPk(account.id, { attributes: ["id", "accountTier"], transaction: t });
  return (org?.accountTier as AccountTier) || DEFAULT_ORGANIZATION_TIER;
};

export const loadActiveGrants = async (account: AccountRef, t?: DbTransaction): Promise<any[]> =>
  FeatureGrant.findAll({
    where: {
      [account.kind === "user" ? "userId" : "organizationId"]: account.id,
      isActive: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    transaction: t,
  });

const loadContext = async (account: AccountRef, t?: DbTransaction): Promise<AccountContext> => {
  const [tier, grants] = await Promise.all([loadAccountTier(account, t), loadActiveGrants(account, t)]);
  return { account, tier, grants };
};

/**
 * The account that "owns" a wallet for tier purposes. Sub-action wallets belong to the
 * action's organization; group / shared / contribution wallets have no tier (null).
 */
export const resolveWalletAccount = async (wallet: any, t?: DbTransaction): Promise<AccountRef | null> => {
  if (wallet.userId) return { kind: "user", id: wallet.userId };
  if (wallet.organizationId) return { kind: "organization", id: wallet.organizationId };
  if (wallet.subActionId) {
    const subAction = await SubAction.findByPk(wallet.subActionId, {
      include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
      transaction: t,
    });
    const organizationId = subAction?.action?.organizationId;
    if (organizationId) return { kind: "organization", id: organizationId };
  }
  return null;
};

const effectiveAccess = (ctx: AccountContext, feature: FeatureKey): FeatureAccess & { granted: boolean } => {
  const base = TIERS[ctx.tier].features[feature];
  const grant = ctx.grants.find((g) => g.feature === feature);
  if (grant) {
    return {
      allowed: true,
      fee: grant.fee == null ? 0 : parseFloat(grant.fee.toString()),
      onDemand: false,
      granted: true,
    };
  }
  return { ...base, granted: false };
};

const assertAllowed = (ctx: AccountContext, feature: FeatureKey): FeatureAccess => {
  const access = effectiveAccess(ctx, feature);
  if (access.allowed) return access;

  const requiredTiers = tiersForKind(ctx.account.kind).filter((tier) => TIERS[tier].features[feature].allowed);
  throw new TierError(
    403,
    "UPGRADE_REQUIRED",
    access.onDemand
      ? `${FEATURE_LABELS[feature]} is available on demand for your account. Please contact QC support.`
      : `${FEATURE_LABELS[feature]} is not included in your ${TIERS[ctx.tier].name} account.`,
    { feature, currentTier: ctx.tier, requiredTiers, onDemand: access.onDemand }
  );
};

export const getFeatureAccess = async (account: AccountRef, feature: FeatureKey, t?: DbTransaction) =>
  effectiveAccess(await loadContext(account, t), feature);

/** Throws UPGRADE_REQUIRED unless the account's tier (or a grant) includes the feature. */
export const assertFeature = async (account: AccountRef, feature: FeatureKey, t?: DbTransaction) =>
  assertAllowed(await loadContext(account, t), feature);

const dailyLimitFor = (ctx: AccountContext): number | null => {
  const grant = ctx.grants.find((g) => g.feature === DAILY_LIMIT_GRANT);
  if (grant) return grant.limitAmount == null ? null : parseFloat(grant.limitAmount.toString());
  return TIERS[ctx.tier].dailyTransferLimit;
};

export const startOfKigaliDay = (now: Date = new Date()): Date => {
  const kigaliNow = new Date(now.getTime() + KIGALI_UTC_OFFSET_MS);
  const kigaliMidnight = Date.UTC(kigaliNow.getUTCFullYear(), kigaliNow.getUTCMonth(), kigaliNow.getUTCDate());
  return new Date(kigaliMidnight - KIGALI_UTC_OFFSET_MS);
};

/** Sum of today's completed sends from a wallet; fees and plan payments don't count. */
export const getTodaySentAmount = async (walletId: string, t?: DbTransaction): Promise<number> => {
  const total = await TransactionModel.sum("amount", {
    where: {
      senderWalletId: walletId,
      receiverWalletId: { [Op.ne]: PLATFORM_WALLET_ID },
      status: "completed",
      createdAt: { [Op.gte]: startOfKigaliDay() },
    },
    transaction: t,
  });
  return parseFloat((total || 0).toString());
};

const assertWithinDailyLimit = async (
  ctx: AccountContext,
  walletId: string,
  amount: number,
  t?: DbTransaction
): Promise<void> => {
  if (!transferLimitsEnabled()) return;
  const limit = dailyLimitFor(ctx);
  if (limit == null) return;

  const used = await getTodaySentAmount(walletId, t);
  if (used + amount > limit) {
    const remaining = Math.max(0, limit - used);
    throw new TierError(
      400,
      "DAILY_LIMIT_EXCEEDED",
      `Daily transfer limit of ${limit} RWF reached for your ${TIERS[ctx.tier].name} account. You can still send ${remaining} RWF today.`,
      { currentTier: ctx.tier, dailyLimit: limit, usedToday: used, remainingToday: remaining }
    );
  }
};

export interface OutgoingQuote {
  fee: number;
  account: AccountRef | null;
  tier: AccountTier | null;
  breakdown: { feature: FeatureKey; fee: number }[];
}

/**
 * Validates an outgoing money movement against the sender wallet owner's tier:
 * every feature used must be allowed, the amount must fit the daily limit, and the
 * returned `fee` (sum of per-use fees, 0 while FEES_ENABLED is off) must be added to
 * what the sender pays, then passed to creditPlatformFee() in the same DB transaction.
 */
export const quoteOutgoing = async (params: {
  senderWallet: any;
  amount: number;
  features?: FeatureKey[];
  transaction?: DbTransaction;
}): Promise<OutgoingQuote> => {
  const { senderWallet, amount, features = [], transaction } = params;
  const account = await resolveWalletAccount(senderWallet, transaction);
  if (!account) return { fee: 0, account: null, tier: null, breakdown: [] };

  const ctx = await loadContext(account, transaction);
  const breakdown: { feature: FeatureKey; fee: number }[] = [];
  for (const feature of features) {
    const access = assertAllowed(ctx, feature);
    if (feesEnabled() && access.fee > 0) breakdown.push({ feature, fee: access.fee });
  }

  if (amount > 0) await assertWithinDailyLimit(ctx, senderWallet.id, amount, transaction);

  return {
    fee: breakdown.reduce((sum, item) => sum + item.fee, 0),
    account,
    tier: ctx.tier,
    breakdown,
  };
};

/** Credits a fee already debited from the sender (as part of totalAmount) to the platform wallet. */
export const creditPlatformFee = async (fee: number, t?: DbTransaction): Promise<void> => {
  if (!fee || fee <= 0) return;
  const platformWallet = await Wallet.findByPk(PLATFORM_WALLET_ID, { lock: t?.LOCK.UPDATE, transaction: t });
  if (!platformWallet) {
    throw new Error("QC platform wallet is missing - run migration 20261111000000-add-account-tiers");
  }
  await platformWallet.increment("balance", { by: fee, transaction: t });
};

/**
 * Moves `amount` from a wallet to the platform wallet as its own transaction
 * (standalone service fees, plan subscriptions). The wallet must already be row-locked.
 */
export const payPlatform = async (params: {
  wallet: any;
  amount: number;
  description: string;
  referencePrefix: string;
  transaction: DbTransaction;
}): Promise<any> => {
  const { wallet, amount, description, referencePrefix, transaction } = params;
  if (getAvailableBalance(wallet) < amount) {
    throw new TierError(
      400,
      "INSUFFICIENT_BALANCE",
      `Insufficient balance. ${amount} RWF is required (${description}).`,
      { requiredAmount: amount, availableBalance: getAvailableBalance(wallet) }
    );
  }

  await wallet.decrement("balance", { by: amount, transaction });
  await wallet.reload({ transaction });
  await creditPlatformFee(amount, transaction);

  return TransactionModel.create(
    {
      referenceId: `${referencePrefix}${Date.now()}${Math.floor(Math.random() * 1000)}`,
      senderWalletId: wallet.id,
      receiverWalletId: PLATFORM_WALLET_ID,
      amount,
      fee: 0,
      totalAmount: amount,
      currency: wallet.currency || "RWF",
      status: "completed",
      type: "payment",
      description,
      hasAccount: true,
    } as any,
    { transaction }
  );
};

/**
 * Gate + standalone fee for features that don't move money to a recipient right away
 * (e.g. opening an escrow). Returns the fee charged (0 when free or fees disabled).
 */
export const chargeFeatureUse = async (params: {
  wallet: any;
  feature: FeatureKey;
  amount?: number;
  transaction: DbTransaction;
}): Promise<number> => {
  const { wallet, feature, amount = 0, transaction } = params;
  const quote = await quoteOutgoing({ senderWallet: wallet, amount, features: [feature], transaction });
  if (quote.fee > 0) {
    await payPlatform({
      wallet,
      amount: quote.fee,
      description: `QC service fee: ${FEATURE_LABELS[feature]}`,
      referencePrefix: "FEE",
      transaction,
    });
  }
  return quote.fee;
};

/** Plan summary for an account: tier definition, effective features and today's limit usage. */
export const describeAccountPlan = async (account: AccountRef, walletId?: string | null) => {
  const ctx = await loadContext(account);
  const definition = TIERS[ctx.tier];
  const dailyLimit = dailyLimitFor(ctx);
  const usedToday = walletId ? await getTodaySentAmount(walletId) : 0;

  const features = Object.fromEntries(
    (Object.keys(definition.features) as FeatureKey[]).map((feature) => {
      const access = effectiveAccess(ctx, feature);
      return [feature, { ...access, fee: feesEnabled() ? access.fee : 0, listedFee: access.fee }];
    })
  );

  return {
    tier: ctx.tier,
    name: definition.name,
    priceRwf: definition.priceRwf,
    currencies: definition.currencies,
    support: definition.support,
    feesEnabled: feesEnabled(),
    dailyTransferLimit: dailyLimit,
    usedToday,
    remainingToday: dailyLimit == null ? null : Math.max(0, dailyLimit - usedToday),
    features,
    grants: ctx.grants,
  };
};
