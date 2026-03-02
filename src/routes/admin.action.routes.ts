import express, { RequestHandler } from "express";
import adminActionController from "../controllers/admin.action.controller";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all admin action routes
router.use(authenticate as RequestHandler);

// Get all actions across all organizations (admin only)
router.get("/", adminActionController.getAllActions as express.RequestHandler);

// Get action by ID (admin only)
router.get(
  "/:id",
  adminActionController.getActionById as express.RequestHandler,
);

// Update action status (admin only)
router.put(
  "/:id/status",
  adminActionController.updateActionStatus as express.RequestHandler,
);

// Delete action (admin only)
router.delete(
  "/:id",
  adminActionController.deleteAction as express.RequestHandler,
);

export default router;
