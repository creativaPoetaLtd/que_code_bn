import express, { RequestHandler } from "express";
import auditLogController from "../controllers/auditLog.controller";
import {
  authenticate,
  requirePermission,
} from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all audit log routes
router.use(authenticate as RequestHandler);

// Get audit log filters (actions, methods, levels)
router.get(
  "/filters",
  requirePermission("view_audit_logs") as RequestHandler,
  auditLogController.getAuditLogFilters as RequestHandler,
);

// Get all audit logs with filtering and pagination
router.get(
  "/",
  requirePermission("view_audit_logs") as RequestHandler,
  auditLogController.getAuditLogs as RequestHandler,
);

// Get audit logs for a specific user
router.get(
  "/user/:userId",
  requirePermission("view_audit_logs") as RequestHandler,
  auditLogController.getUserAuditLogs as RequestHandler,
);

// Get audit log by ID (must be after /user/:userId)
router.get(
  "/:id",
  requirePermission("view_audit_logs") as RequestHandler,
  auditLogController.getAuditLogById as RequestHandler,
);

export default router;
