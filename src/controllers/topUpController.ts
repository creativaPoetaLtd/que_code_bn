// topUpController.ts
// Wallet top-ups from mobile money. While no real provider is integrated, top-ups run
// against the simulated provider (TOPUP_SIMULATION_ENABLED=true) - see services/topUpProviders.ts.
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { AccountRef } from "../services/accountTier.service";
import {
  MAX_TOPUP_AMOUNT,
  MIN_TOPUP_AMOUNT,
  TOPUP_PENDING_TIMEOUT_MINUTES,
  TopUpError,
  findOwnTopUp,
  initiateTopUp,
  listOwnTopUps,
  serializeTopUp,
  settleTopUp,
} from "../services/topUp.service";
import { listTopUpProviders, topUpSimulationEnabled } from "../services/topUpProviders";

const handleError = (res: Response, error: unknown, context: string): void => {
  if (error instanceof TopUpError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error(`${context} error:`, error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

const callerAccount = (req: AuthRequest): AccountRef => {
  if (!req.user) throw new TopUpError(401, "Authentication required");
  return { kind: req.user.accountType, id: req.user.id };
};

/** GET /topups/options - providers, limits and whether top-ups are simulated. */
export const getTopUpOptions = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      simulation: topUpSimulationEnabled(),
      minAmount: MIN_TOPUP_AMOUNT,
      maxAmount: MAX_TOPUP_AMOUNT,
      currency: "RWF",
      pendingTimeoutMinutes: TOPUP_PENDING_TIMEOUT_MINUTES,
      providers: listTopUpProviders(),
    },
  });
};

/**
 * POST /topups { amount, provider, phoneNumber, note? }
 * 202: the payer gets a prompt on their phone; poll GET /topups/:id (or wait for the
 * TOPUP_SUCCESSFUL / TOPUP_FAILED notification) for the outcome.
 */
export const createTopUp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { topUp, duplicate } = await initiateTopUp(req.app as any, callerAccount(req), req.body || {});
    res.status(duplicate ? 200 : 202).json({
      success: true,
      message: duplicate
        ? "A top-up with these details is already waiting for approval"
        : "Approve the payment on your phone to complete the top-up",
      data: serializeTopUp(topUp),
    });
  } catch (error) {
    handleError(res, error, "Create top-up");
  }
};

/** GET /topups?page&limit - the caller's top-ups, newest first. */
export const listMyTopUps = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const { count, rows } = await listOwnTopUps(callerAccount(req), page, limit);
    res.status(200).json({
      success: true,
      data: {
        topUps: rows.map(serializeTopUp),
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      },
    });
  } catch (error) {
    handleError(res, error, "List top-ups");
  }
};

/** GET /topups/:id - status polling. */
export const getTopUp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const topUp = await findOwnTopUp(callerAccount(req), req.params.id as string);
    res.status(200).json({ success: true, data: serializeTopUp(topUp) });
  } catch (error) {
    handleError(res, error, "Get top-up");
  }
};

/**
 * POST /topups/:id/simulate { outcome: "successful" | "failed" } - simulation only.
 * Settles a pending simulated top-up right away (QA / frontend testing without waiting).
 */
export const simulateTopUpOutcome = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!topUpSimulationEnabled()) throw new TopUpError(404, "Top-up simulation is disabled");

    const { outcome } = req.body || {};
    if (outcome !== "successful" && outcome !== "failed") {
      throw new TopUpError(400, "outcome must be 'successful' or 'failed'");
    }

    const topUp = await findOwnTopUp(callerAccount(req), req.params.id as string);
    if (!topUp.simulated) throw new TopUpError(400, "Only simulated top-ups can be settled manually");
    if (topUp.status !== "pending") throw new TopUpError(400, `Top-up is already ${topUp.status}`);

    await settleTopUp(
      req.app as any,
      topUp.id,
      outcome === "successful" ? { status: "successful" } : { status: "failed", reason: "Simulated failure" }
    );
    await topUp.reload();
    res.status(200).json({ success: true, data: serializeTopUp(topUp) });
  } catch (error) {
    handleError(res, error, "Simulate top-up");
  }
};
