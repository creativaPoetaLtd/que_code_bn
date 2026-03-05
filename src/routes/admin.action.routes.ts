import express, { RequestHandler } from "express";
import adminActionController from "../controllers/admin.action.controller";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all admin action routes
router.use(authenticate as RequestHandler);

// Get all actions across all organizations (admin only)
router.get("/", adminActionController.getAllActions as express.RequestHandler);

// Update action status (admin only)
router.put(
  "/:id/status",
  adminActionController.updateActionStatus as express.RequestHandler,
);

// Suspend action (admin only - for unlawful actions)
router.put(
  "/:id/suspend",
  adminActionController.suspendAction as express.RequestHandler,
);

// Unsuspend action (admin only)
router.put(
  "/:id/unsuspend",
  adminActionController.unsuspendAction as express.RequestHandler,
);

// Get sub-actions for an action (admin only)
router.get(
  "/:id/sub-actions",
  adminActionController.getActionSubActions as express.RequestHandler,
);

// Get action by ID (admin only) - MUST come after specific routes
router.get(
  "/:id",
  adminActionController.getActionById as express.RequestHandler,
);

// Delete action (admin only)
router.delete(
  "/:id",
  adminActionController.deleteAction as express.RequestHandler,
);

export default router;
