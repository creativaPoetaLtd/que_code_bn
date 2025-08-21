import Models from "../database/models";
import { NotificationType, NotificationPayload } from "./notificationConfig";
import { Application } from "express";

/**
 * Emits a notification event to a specific user or group of users via Socket.IO
 * @param app Express app instance
 * @param payload NotificationPayload
 */
export function sendNotification(
  app: Application,
  payload: NotificationPayload
) {
  const io = app.get("io");
  if (!io) return;

  // For single recipient (userId as socket room)
  io.to(payload.recipientId).emit("notification", payload);
}

/**
 * Optionally, broadcast to multiple users
 */
export function sendBulkNotification(
  app: Application,
  payloads: NotificationPayload[]
) {
  const io = app.get("io");
  if (!io) return;
  payloads.forEach((payload) => {
    io.to(payload.recipientId).emit("notification", payload);
  });
}

// --- Notification DB helpers ---
/**
 * Create a notification in DB and send via socket
 */
export async function createAndSendNotification(
  app: Application,
  payload: NotificationPayload
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  // Save to DB
  await models.Notification.create({
    userId: payload.recipientId,
    type: payload.type,
    data: payload.data,
    isRead: false,
  });
  // Send via socket
  sendNotification(app, payload);
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  app: Application,
  notificationId: string,
  userId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const notification = await models.Notification.findOne({
    where: { id: notificationId, userId },
  });
  if (notification) {
    notification.isRead = true;
    await notification.save();
    return true;
  }
  return false;
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(app: Application, userId: string) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const [notifications, unreadCount] = await Promise.all([
    models.Notification.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    }),
    models.Notification.count({
      where: { userId, isRead: false },
    }),
  ]);
  return { notifications, unreadCount };
}
