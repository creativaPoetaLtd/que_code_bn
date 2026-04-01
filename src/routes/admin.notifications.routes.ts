import express, { RequestHandler } from "express";
import {
  getAllNotifications,
  broadcastNotification,
  deleteNotification,
  getNotificationTypes,
} from "../controllers/admin.notifications.controller";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();
const guard = [authenticate as RequestHandler, requireRole("admin", "super_admin") as RequestHandler];

// GET  /api/v1/admin/notifications          — list all notifications
router.get("/", ...guard, getAllNotifications);

// GET  /api/v1/admin/notifications/types    — distinct types used
router.get("/types", ...guard, getNotificationTypes);

// POST /api/v1/admin/notifications/broadcast — send broadcast to all/selected users
router.post("/broadcast", ...guard, broadcastNotification);

// DELETE /api/v1/admin/notifications/:id    — hard delete a notification
router.delete("/:id", ...guard, deleteNotification);

export default router;
