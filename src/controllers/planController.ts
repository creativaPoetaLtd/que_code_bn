// planController.ts
// QC account types: public plan catalogue, the caller's own plan, self-service plan
// changes, and admin tools (assign any tier, grant "on demand" features / custom limits).
import { Response } from "express";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { verifyTransactionPin, PinVerificationError } from "../utils/verifyPin";
import {
  AccountTier,
  FEATURE_KEYS,
  FEATURE_LABELS,
  SELF_SERVICE_TIERS,
  TIERS,
  feesEnabled,
  isAccountTier,
  isFeatureKey,
  tiersForKind,
  transferLimitsEnabled,
} from "../utils/accountTiers";
import {
  AccountRef,
  DAILY_LIMIT_GRANT,
  describeAccountPlan,
  sendTierError,
} from "../services/accountTier.service";
import {
  cancelPlan,
  changePlan,
  getActiveSubscription,
  notifyPlanChanged,
  setAccountTier,
} from "../services/accountSubscription.service";

const { User, Organization, Wallet, FeatureGrant } = database_models as any;

class PlanError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const handleError = (res: Response, error: unknown, context: string): void => {
  if (error instanceof PlanError || error instanceof PinVerificationError) {
    const body: Record<string, unknown> = { success: false, message: error.message };
    if (error instanceof PinVerificationError && error.requiresPinSetup) body.requiresPinSetup = true;
    res.status(error.status).json(body);
    return;
  }
  if (sendTierError(res, error)) return;
  console.error(`${context} error:`, error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

const callerAccount = (req: AuthRequest): AccountRef => {
  if (!req.user) throw new PlanError(401, "Authentication required");
  return { kind: req.user.accountType, id: req.user.id };
};

const parseAccountParams = (req: AuthRequest): AccountRef => {
  const { kind, id } = req.params as { kind: string; id: string };
  if (kind !== "user" && kind !== "organization") {
    throw new PlanError(400, "kind must be 'user' or 'organization'");
  }
  return { kind, id };
};

const findAccount = async (account: AccountRef) => {
  const Model = account.kind === "user" ? User : Organization;
  const entity = await Model.findByPk(account.id, { attributes: ["id", "accountTier"] });
  if (!entity) throw new PlanError(404, `${account.kind === "user" ? "User" : "Organization"} not found`);
  return entity;
};

const buildPlanSummary = async (account: AccountRef) => {
  const wallet = await Wallet.findOne({
    where: account.kind === "user" ? { userId: account.id } : { organizationId: account.id },
    attributes: ["id"],
  });
  const [plan, subscription, organization] = await Promise.all([
    describeAccountPlan(account, wallet?.id),
    getActiveSubscription(account),
    account.kind === "organization"
      ? Organization.findByPk(account.id, { attributes: ["id", "npoRequestedAt", "npoRequestNote"] })
      : null,
  ]);
  const npoRequest = organization?.npoRequestedAt
    ? { requestedAt: organization.npoRequestedAt, note: organization.npoRequestNote }
    : null;
  return { ...plan, subscription, npoRequest };
};

const NPO_REQUEST_NOTE_MAX = 1000;

/** GET /plans - the full account type matrix, for the pricing page. */
export const listPlans = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      feesEnabled: feesEnabled(),
      transferLimitsEnabled: transferLimitsEnabled(),
      selfServiceTiers: SELF_SERVICE_TIERS,
      features: FEATURE_KEYS.map((key) => ({ key, label: FEATURE_LABELS[key] })),
      tiers: Object.values(TIERS),
    },
  });
};

/** GET /plans/me - the caller's tier, effective features, limit usage and subscription. */
export const getMyPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await buildPlanSummary(callerAccount(req)) });
  } catch (error) {
    handleError(res, error, "Get my plan");
  }
};

/** POST /plans/me/change { tier, pin } - self-service upgrade / downgrade (users only). */
export const changeMyPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = callerAccount(req);
    const { tier, pin } = req.body as { tier?: string; pin?: string };

    if (account.kind !== "user") {
      throw new PlanError(403, "Organization account types are set by QC. Please contact support.");
    }
    if (!isAccountTier(tier) || !SELF_SERVICE_TIERS.includes(tier as any)) {
      throw new PlanError(400, `tier must be one of: ${SELF_SERVICE_TIERS.join(", ")}`);
    }

    // Moving money out of the wallet always needs the PIN; free downgrades don't.
    if ((TIERS[tier].priceRwf ?? 0) > 0) {
      await verifyTransactionPin(account.id, pin as string);
    }

    const result = await changePlan(account, tier);
    if (result.effective === "now") await notifyPlanChanged(req.app as any, account, result.tier);

    res.status(200).json({
      success: true,
      message:
        result.effective === "now"
          ? `Your account is now ${TIERS[result.tier].name}`
          : `Your account will switch to ${TIERS[result.tier].name} at the end of the current period`,
      data: { ...result, plan: await buildPlanSummary(account) },
    });
  } catch (error) {
    handleError(res, error, "Change my plan");
  }
};

/** POST /plans/me/cancel - stop auto-renewal; the paid tier lasts until the period ends. */
export const cancelMyPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = callerAccount(req);
    const subscription = await cancelPlan(account);
    res.status(200).json({
      success: true,
      message: `Your plan will not renew. It stays active until ${new Date(subscription.currentPeriodEnd).toISOString()}`,
      data: { subscription },
    });
  } catch (error) {
    handleError(res, error, "Cancel my plan");
  }
};

/**
 * POST /plans/me/npo-request { note } - an organization asks QC to become a non-profit.
 * It stays Business until an admin approves (sets the NPO account type) or rejects.
 */
export const requestNpo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = callerAccount(req);
    if (account.kind !== "organization") throw new PlanError(403, "Only organizations can request the NPO account type");

    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (note.length < 10) {
      throw new PlanError(400, "Tell us briefly about your non-profit (at least 10 characters)");
    }
    if (note.length > NPO_REQUEST_NOTE_MAX) {
      throw new PlanError(400, `Keep the description under ${NPO_REQUEST_NOTE_MAX} characters`);
    }

    const organization = await Organization.findByPk(account.id);
    if (!organization) throw new PlanError(404, "Organization not found");
    if (organization.accountTier === "NPO") throw new PlanError(400, "Your organization is already an NPO");

    await organization.update({ npoRequestedAt: new Date(), npoRequestNote: note });
    res.status(200).json({
      success: true,
      message: "Request sent. QC will review it and update your account type.",
      data: await buildPlanSummary(account),
    });
  } catch (error) {
    handleError(res, error, "Request NPO");
  }
};

/** DELETE /plans/me/npo-request - withdraw a pending NPO request. */
export const cancelNpoRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = callerAccount(req);
    if (account.kind !== "organization") throw new PlanError(403, "Only organizations have NPO requests");
    await Organization.update({ npoRequestedAt: null, npoRequestNote: null }, { where: { id: account.id } });
    res.status(200).json({ success: true, message: "NPO request withdrawn" });
  } catch (error) {
    handleError(res, error, "Cancel NPO request");
  }
};

/** GET /admin/plans/npo-requests - organizations waiting for NPO approval, oldest first. */
export const adminListNpoRequests = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const organizations = await Organization.findAll({
      where: { npoRequestedAt: { [Op.ne]: null } },
      attributes: ["id", "name", "email", "tinNumber", "status", "accountTier", "npoRequestedAt", "npoRequestNote"],
      order: [["npoRequestedAt", "ASC"]],
    });
    res.status(200).json({ success: true, data: organizations });
  } catch (error) {
    handleError(res, error, "Admin list NPO requests");
  }
};

/**
 * POST /admin/plans/npo-requests/:organizationId/reject - decline a request (the
 * organization stays Business). Approve with PUT /admin/plans/accounts/organization/:id/tier.
 */
export const adminRejectNpoRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const organization = await Organization.findByPk(req.params.organizationId);
    if (!organization) throw new PlanError(404, "Organization not found");
    if (!organization.npoRequestedAt) throw new PlanError(400, "This organization has no pending NPO request");
    await organization.update({ npoRequestedAt: null, npoRequestNote: null });
    res.status(200).json({ success: true, message: "NPO request rejected" });
  } catch (error) {
    handleError(res, error, "Admin reject NPO request");
  }
};

/** GET /admin/plans/accounts/:kind/:id */
export const adminGetAccountPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = parseAccountParams(req);
    await findAccount(account);
    res.status(200).json({ success: true, data: await buildPlanSummary(account) });
  } catch (error) {
    handleError(res, error, "Admin get account plan");
  }
};

/**
 * PUT /admin/plans/accounts/:kind/:id/tier { tier } - assign any tier without billing
 * (agents, NPO approval, negotiated business deals, complimentary upgrades).
 */
export const adminSetAccountTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = parseAccountParams(req);
    const { tier } = req.body as { tier?: string };
    const allowed = tiersForKind(account.kind);
    if (!isAccountTier(tier) || !allowed.includes(tier)) {
      throw new PlanError(400, `tier must be one of: ${allowed.join(", ")}`);
    }

    await findAccount(account);
    const current = await getActiveSubscription(account);
    if (current) await current.update({ status: "cancelled", autoRenew: false, pendingTier: null });
    await setAccountTier(account, tier as AccountTier);
    if (account.kind === "organization") {
      // Setting the type answers any pending NPO request.
      await Organization.update({ npoRequestedAt: null, npoRequestNote: null }, { where: { id: account.id } });
    }
    await notifyPlanChanged(req.app as any, account, tier as AccountTier);

    res.status(200).json({ success: true, message: `Account type set to ${TIERS[tier].name}`, data: await buildPlanSummary(account) });
  } catch (error) {
    handleError(res, error, "Admin set account tier");
  }
};

const parseGrantBody = (body: any, partial: boolean) => {
  const data: Record<string, unknown> = {};

  if (!partial || body.feature !== undefined) {
    if (!isFeatureKey(body.feature) && body.feature !== DAILY_LIMIT_GRANT) {
      throw new PlanError(400, `feature must be one of: ${[...FEATURE_KEYS, DAILY_LIMIT_GRANT].join(", ")}`);
    }
    data.feature = body.feature;
  }
  for (const field of ["fee", "limitAmount"] as const) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && !(Number(body[field]) >= 0)) {
      throw new PlanError(400, `${field} must be a non-negative number or null`);
    }
    data[field] = body[field] === null ? null : Number(body[field]);
  }
  if (body.expiresAt !== undefined) {
    const expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt);
    if (expiresAt && isNaN(expiresAt.getTime())) throw new PlanError(400, "expiresAt must be a valid date");
    data.expiresAt = expiresAt;
  }
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.note !== undefined) data.note = body.note;
  return data;
};

/** GET /admin/plans/accounts/:kind/:id/grants */
export const adminListGrants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = parseAccountParams(req);
    const grants = await FeatureGrant.findAll({
      where: account.kind === "user" ? { userId: account.id } : { organizationId: account.id },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json({ success: true, data: grants });
  } catch (error) {
    handleError(res, error, "Admin list feature grants");
  }
};

/** POST /admin/plans/accounts/:kind/:id/grants { feature, fee?, limitAmount?, expiresAt?, note? } */
export const adminCreateGrant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = parseAccountParams(req);
    await findAccount(account);
    const data = parseGrantBody(req.body, false);

    // One active grant per feature: replace rather than stack.
    await FeatureGrant.update(
      { isActive: false },
      {
        where: {
          ...(account.kind === "user" ? { userId: account.id } : { organizationId: account.id }),
          feature: data.feature,
          isActive: true,
        },
      }
    );

    const grant = await FeatureGrant.create({
      ...data,
      ...(account.kind === "user" ? { userId: account.id } : { organizationId: account.id }),
      isActive: true,
      grantedByUserId: req.user?.accountType === "user" ? req.user.id : null,
    });
    res.status(201).json({ success: true, data: grant });
  } catch (error) {
    handleError(res, error, "Admin create feature grant");
  }
};

/** PUT /admin/plans/grants/:grantId */
export const adminUpdateGrant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const grant = await FeatureGrant.findByPk(req.params.grantId);
    if (!grant) throw new PlanError(404, "Feature grant not found");
    await grant.update(parseGrantBody(req.body, true));
    res.status(200).json({ success: true, data: grant });
  } catch (error) {
    handleError(res, error, "Admin update feature grant");
  }
};

/** DELETE /admin/plans/grants/:grantId */
export const adminDeleteGrant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const grant = await FeatureGrant.findByPk(req.params.grantId);
    if (!grant) throw new PlanError(404, "Feature grant not found");
    await grant.destroy();
    res.status(200).json({ success: true, message: "Feature grant removed" });
  } catch (error) {
    handleError(res, error, "Admin delete feature grant");
  }
};
