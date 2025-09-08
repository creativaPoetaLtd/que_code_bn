import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as notificationController from "../controllers/notificationController";

const router = Router();
router.use(authenticate);

// Get all notifications for the authenticated user (with pagination)
router.get('/', notificationController.getNotifications as RequestHandler);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount as RequestHandler);

// Mark a specific notification as read
router.patch('/:notificationId/read', notificationController.markNotificationRead as RequestHandler);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllNotificationsRead as RequestHandler);

// Delete a specific notification
router.delete('/:notificationId', notificationController.deleteNotification as RequestHandler);

export default router;
