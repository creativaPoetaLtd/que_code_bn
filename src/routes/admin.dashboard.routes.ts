import express, { RequestHandler } from "express";
import adminDashboardController from "../controllers/admin.dashboard.controller";
import {
  authenticate,
  requireRole,
} from "../middleware/auth.unified.middleware";

const router = express.Router();

router.get(
  "/statistics",
  authenticate as RequestHandler,
  requireRole("admin", "super_admin") as RequestHandler,
  adminDashboardController.getDashboardStatistics as RequestHandler,
);

export default router;
