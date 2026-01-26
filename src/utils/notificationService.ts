import Models from "../database/models";
import { NotificationType, NotificationPayload } from "./notificationConfig";
import { Application } from "express";
import { Op } from "sequelize";

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

  // For single recipient (userId as socket room) - user rooms are prefixed with 'user_'
  io.to(`user_${payload.recipientId}`).emit("notification", payload);
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
    io.to(`user_${payload.recipientId}`).emit("notification", payload);
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
  const notification = await models.Notification.create({
    userId: payload.recipientId,
    type: payload.type,
    data: payload.data,
    isRead: false,
  });
  // Send via socket
  sendNotification(app, payload);
  return notification;
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
 * Get all notifications for a user with pagination
 */
export async function getUserNotifications(
  app: Application, 
  userId: string, 
  page: number = 1, 
  limit: number = 20
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const offset = (page - 1) * limit;
  
  const [notifications, unreadCount, totalCount] = await Promise.all([
    models.Notification.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    }),
    models.Notification.count({
      where: { userId, isRead: false },
    }),
    models.Notification.count({
      where: { userId },
    }),
  ]);
  return { notifications, unreadCount, totalCount };
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  app: Application,
  userId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const [updatedCount] = await models.Notification.update(
    { isRead: true },
    { 
      where: { userId, isRead: false },
      returning: false 
    }
  );
  return updatedCount;
}

/**
 * Delete notifications older than specified days
 */
export async function cleanupOldNotifications(
  app: Application,
  daysOld: number = 30
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const deletedCount = await models.Notification.destroy({
    where: {
      createdAt: {
        [Op.lt]: cutoffDate
      }
    }
  });
  
  return deletedCount;
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStats(
  app: Application,
  userId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  
  const [total, unread, readToday] = await Promise.all([
    models.Notification.count({
      where: { userId }
    }),
    models.Notification.count({
      where: { userId, isRead: false }
    }),
    models.Notification.count({
      where: {
        userId,
        isRead: true,
        updatedAt: {
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);
  
  return {
    total,
    unread,
    read: total - unread,
    readToday
  };
}
