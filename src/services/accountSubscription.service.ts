// accountSubscription.service.ts
// Monthly billing for paid account types. Plans are paid from the QC wallet (no external
// top-up exists yet): upgrades charge the full price now and start a new period, downgrades
// take effect at the end of the paid period, and the renewal job retries a failed charge
// for SUBSCRIPTION_GRACE_DAYS before dropping the account back to its default tier.
import { Application } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { createAndSendNotification } from "../utils/notificationService";
import { NotificationType } from "../utils/notificationConfig";
import {
  AccountTier,
  DEFAULT_ORGANIZATION_TIER,
  DEFAULT_USER_TIER,
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_PERIOD_DAYS,
  TIERS,
} from "../utils/accountTiers";
import { AccountRef, TierError, payPlatform } from "./accountTier.service";

const { sequelize, User, Organization, Wallet, AccountSubscription } = database_models as any;

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEWAL_BATCH_SIZE = 100;

const ownerWhere = (account: AccountRef) =>
  account.kind === "user" ? { userId: account.id } : { organizationId: account.id };

const defaultTierFor = (account: AccountRef): AccountTier =>
  account.kind === "user" ? DEFAULT_USER_TIER : DEFAULT_ORGANIZATION_TIER;

const subscriptionAccount = (subscription: any): AccountRef =>
  subscription.userId
    ? { kind: "user", id: subscription.userId }
    : { kind: "organization", id: subscription.organizationId };

const priceOf = (tier: AccountTier): number => TIERS[tier].priceRwf ?? 0;

export const setAccountTier = async (account: AccountRef, tier: AccountTier, t?: DbTransaction) => {
  const Model = account.kind === "user" ? User : Organization;
  await Model.update({ accountTier: tier }, { where: { id: account.id }, transaction: t });
};

export const getActiveSubscription = (account: AccountRef, t?: DbTransaction) =>
  AccountSubscription.findOne({
    where: { ...ownerWhere(account), status: { [Op.in]: ["active", "past_due"] } },
    order: [["createdAt", "DESC"]],
    transaction: t,
    lock: t ? t.LOCK.UPDATE : undefined,
  });

const lockWallet = async (account: AccountRef, t: DbTransaction) => {
  const wallet = await Wallet.findOne({
    where: { ...ownerWhere(account), isActive: true },
    lock: t.LOCK.UPDATE,
    transaction: t,
  });
  if (!wallet) throw new TierError(404, "WALLET_NOT_FOUND", "Wallet not found or inactive");
  return wallet;
};

const chargePlan = (wallet: any, tier: AccountTier, t: DbTransaction) =>
  payPlatform({
    wallet,
    amount: priceOf(tier),
    description: `QC ${TIERS[tier].name} plan (${SUBSCRIPTION_PERIOD_DAYS} days)`,
    referencePrefix: "PLAN",
    transaction: t,
  });

const notifyPlan = async (app: Application, account: AccountRef, type: NotificationType, message: string) => {
  // Notifications are user-addressed; organizations have no notification inbox yet.
  if (account.kind !== "user") return;
  try {
    await createAndSendNotification(app, {
      type,
      recipientId: account.id,
      data: { message, url: "/settings/plan" },
    } as any);
  } catch (error) {
    console.error("[plans] Notification failed:", error);
  }
};

export type PlanChangeResult = {
  tier: AccountTier;
  effective: "now" | "end_of_period";
  effectiveAt: Date;
  chargedRwf: number;
  subscription: any | null;
};

/**
 * Self-service plan change. Paying more → charged now, new period starts now (no proration).
 * Paying less (or the free tier) while a paid period is running → scheduled for its end.
 */
export const changePlan = async (account: AccountRef, targetTier: AccountTier): Promise<PlanChangeResult> =>
  sequelize.transaction(async (t: DbTransaction) => {
    const Model = account.kind === "user" ? User : Organization;
    const entity = await Model.findByPk(account.id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!entity) throw new TierError(404, "ACCOUNT_NOT_FOUND", "Account not found");

    const currentTier = entity.accountTier as AccountTier;
    const current = await getActiveSubscription(account, t);

    if (currentTier === targetTier) {
      // Re-selecting the current paid tier undoes a pending downgrade / cancellation.
      if (current && (current.pendingTier || !current.autoRenew)) {
        await current.update({ pendingTier: null, autoRenew: true }, { transaction: t });
        return { tier: targetTier, effective: "now", effectiveAt: new Date(), chargedRwf: 0, subscription: current };
      }
      throw new TierError(400, "SAME_TIER", `You are already on the ${TIERS[targetTier].name} plan`);
    }

    const targetPrice = priceOf(targetTier);
    const currentPrice = current ? parseFloat(current.priceRwf.toString()) : 0;

    if (current && current.status === "active" && targetPrice < currentPrice) {
      await current.update({ pendingTier: targetTier, autoRenew: true }, { transaction: t });
      return {
        tier: targetTier,
        effective: "end_of_period",
        effectiveAt: current.currentPeriodEnd,
        chargedRwf: 0,
        subscription: current,
      };
    }

    if (current) {
      await current.update({ status: "cancelled", autoRenew: false, pendingTier: null }, { transaction: t });
    }

    let subscription: any = null;
    if (targetPrice > 0) {
      const wallet = await lockWallet(account, t);
      const charge = await chargePlan(wallet, targetTier, t);
      const now = new Date();
      subscription = await AccountSubscription.create(
        {
          ...ownerWhere(account),
          tier: targetTier,
          priceRwf: targetPrice,
          status: "active",
          autoRenew: true,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + SUBSCRIPTION_PERIOD_DAYS * DAY_MS),
          lastChargeTransactionId: charge.id,
        },
        { transaction: t }
      );
    }

    await entity.update({ accountTier: targetTier }, { transaction: t });
    return { tier: targetTier, effective: "now", effectiveAt: new Date(), chargedRwf: targetPrice, subscription };
  });

/** Stops auto-renewal; the paid tier stays until the end of the current period. */
export const cancelPlan = async (account: AccountRef) =>
  sequelize.transaction(async (t: DbTransaction) => {
    const current = await getActiveSubscription(account, t);
    if (!current) throw new TierError(400, "NO_SUBSCRIPTION", "You have no paid plan to cancel");
    await current.update({ autoRenew: false, pendingTier: null }, { transaction: t });
    return current;
  });

type RenewalOutcome =
  | { kind: "renewed"; tier: AccountTier; price: number }
  | { kind: "expired"; tier: AccountTier }
  | { kind: "past_due"; tier: AccountTier; price: number }
  | { kind: "skipped" };

const renewOne = async (subscriptionId: string): Promise<{ account: AccountRef; outcome: RenewalOutcome }> => {
  let account: AccountRef | null = null;

  const outcome: RenewalOutcome = await sequelize.transaction(async (t: DbTransaction) => {
    const subscription = await AccountSubscription.findByPk(subscriptionId, {
      lock: t.LOCK.UPDATE,
      skipLocked: true,
      transaction: t,
    });
    if (!subscription || !["active", "past_due"].includes(subscription.status)) return { kind: "skipped" };
    if (new Date(subscription.currentPeriodEnd) > new Date()) return { kind: "skipped" };

    account = subscriptionAccount(subscription);
    const nextTier = (subscription.pendingTier || subscription.tier) as AccountTier;

    const expire = async (tier: AccountTier): Promise<RenewalOutcome> => {
      await subscription.update({ status: "expired", pendingTier: null }, { transaction: t });
      await setAccountTier(account!, tier, t);
      return { kind: "expired", tier };
    };

    if (!subscription.autoRenew) return expire(defaultTierFor(account));
    if (priceOf(nextTier) <= 0) return expire(nextTier);

    const price = priceOf(nextTier);
    try {
      const wallet = await lockWallet(account, t);
      const charge = await chargePlan(wallet, nextTier, t);
      const now = new Date();
      await subscription.update(
        {
          tier: nextTier,
          pendingTier: null,
          priceRwf: price,
          status: "active",
          pastDueSince: null,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + SUBSCRIPTION_PERIOD_DAYS * DAY_MS),
          lastChargeTransactionId: charge.id,
        },
        { transaction: t }
      );
      await setAccountTier(account, nextTier, t);
      return { kind: "renewed", tier: nextTier, price };
    } catch (error) {
      if (!(error instanceof TierError)) throw error;

      const pastDueSince = subscription.pastDueSince ? new Date(subscription.pastDueSince) : new Date();
      if (Date.now() - pastDueSince.getTime() >= SUBSCRIPTION_GRACE_DAYS * DAY_MS) {
        return expire(defaultTierFor(account));
      }
      if (subscription.status !== "past_due") {
        await subscription.update({ status: "past_due", pastDueSince }, { transaction: t });
        return { kind: "past_due", tier: nextTier, price };
      }
      return { kind: "skipped" };
    }
  });

  return { account: account!, outcome };
};

/** Renews / downgrades / expires every subscription whose period has ended. */
export const processDueSubscriptions = async (app: Application): Promise<void> => {
  const due = await AccountSubscription.findAll({
    where: { status: { [Op.in]: ["active", "past_due"] }, currentPeriodEnd: { [Op.lte]: new Date() } },
    attributes: ["id"],
    limit: RENEWAL_BATCH_SIZE,
  });

  for (const { id } of due) {
    try {
      const { account, outcome } = await renewOne(id);
      if (outcome.kind === "renewed") {
        await notifyPlan(
          app,
          account,
          NotificationType.PLAN_RENEWED,
          `Your ${TIERS[outcome.tier].name} plan was renewed for ${outcome.price} RWF.`
        );
      } else if (outcome.kind === "past_due") {
        await notifyPlan(
          app,
          account,
          NotificationType.PLAN_PAYMENT_FAILED,
          `We couldn't renew your ${TIERS[outcome.tier].name} plan (${outcome.price} RWF). Add funds within ${SUBSCRIPTION_GRACE_DAYS} days to keep it.`
        );
      } else if (outcome.kind === "expired") {
        await notifyPlan(
          app,
          account,
          NotificationType.PLAN_EXPIRED,
          `Your account is now on the ${TIERS[outcome.tier].name} plan.`
        );
      }
    } catch (error) {
      console.error(`[plans] Renewal failed for subscription ${id}:`, error);
    }
  }
};

export const notifyPlanChanged = (app: Application, account: AccountRef, tier: AccountTier) =>
  notifyPlan(app, account, NotificationType.PLAN_CHANGED, `Your account is now on the ${TIERS[tier].name} plan.`);
