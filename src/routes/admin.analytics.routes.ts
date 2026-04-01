import express, { RequestHandler } from "express";
import { getPlatformAnalytics } from "../controllers/admin.analytics.controller";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();
const guard = [authenticate as RequestHandler, requireRole("admin", "super_admin") as RequestHandler];

// GET /api/v1/admin/analytics/platform?range=30d
router.get("/platform", ...guard, getPlatformAnalytics);

export default router;
