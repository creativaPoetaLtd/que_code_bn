import express, { RequestHandler } from "express";
import * as planController from "../controllers/planController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Public plan catalogue (pricing page)
router.get("/", planController.listPlans as unknown as RequestHandler);

// The caller's own account type
router.get("/me", authenticate as unknown as RequestHandler, planController.getMyPlan as unknown as RequestHandler);
router.post("/me/change", authenticate as unknown as RequestHandler, planController.changeMyPlan as unknown as RequestHandler);
router.post("/me/cancel", authenticate as unknown as RequestHandler, planController.cancelMyPlan as unknown as RequestHandler);

// Organizations: ask QC for the NPO account type
router.post("/me/npo-request", authenticate as unknown as RequestHandler, planController.requestNpo as unknown as RequestHandler);
router.delete("/me/npo-request", authenticate as unknown as RequestHandler, planController.cancelNpoRequest as unknown as RequestHandler);

export default router;
