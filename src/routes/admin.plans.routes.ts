import express, { RequestHandler } from "express";
import * as planController from "../controllers/planController";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();
const guard = [authenticate as unknown as RequestHandler, requireRole("admin", "super_admin") as unknown as RequestHandler];
const handle = (fn: unknown) => fn as RequestHandler;

// GET  /api/v1/admin/plans/accounts/:kind/:id         — plan summary for a user or organization
router.get("/accounts/:kind/:id", ...guard, handle(planController.adminGetAccountPlan));

// PUT  /api/v1/admin/plans/accounts/:kind/:id/tier    — assign an account type (no billing)
router.put("/accounts/:kind/:id/tier", ...guard, handle(planController.adminSetAccountTier));

// NPO requests: approve with PUT /accounts/organization/:id/tier { tier: "NPO" }
router.get("/npo-requests", ...guard, handle(planController.adminListNpoRequests));
router.post("/npo-requests/:organizationId/reject", ...guard, handle(planController.adminRejectNpoRequest));

// "On demand" features and custom daily limits
router.get("/accounts/:kind/:id/grants", ...guard, handle(planController.adminListGrants));
router.post("/accounts/:kind/:id/grants", ...guard, handle(planController.adminCreateGrant));
router.put("/grants/:grantId", ...guard, handle(planController.adminUpdateGrant));
router.delete("/grants/:grantId", ...guard, handle(planController.adminDeleteGrant));

export default router;
