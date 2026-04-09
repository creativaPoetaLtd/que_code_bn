import { Request, Response, RequestHandler } from "express";
import Models from "../database/models";
import { Op } from "sequelize";
import { createAndSendNotification } from "../utils/notificationService";
import { NotificationType } from "../utils/notificationConfig";

// GET /api/v1/admin/notifications — list all platform notifications with filters
export const getAllNotifications: RequestHandler = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      isRead,
      userId,
      search,
      startDate,
      endDate,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (isRead === "true") whereClause.isRead = true;
    if (isRead === "false") whereClause.isRead = false;
    if (userId) whereClause.userId = userId;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate as string);
    }

    const { count, rows: notifications } = await models.Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "user",
          required: false,
          attributes: ["id", "firstName", "lastName", "email"],
          ...(search ? {
            where: {
              [Op.or]: [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
              ],
            },
          } : {}),
        },
      ],
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Stats in parallel
    const [totalCount, unreadCount, todayCount] = await Promise.all([
      models.Notification.count(),
      models.Notification.count({ where: { isRead: false } }),
      models.Notification.count({
        where: { createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      statistics: { total: totalCount, unread: unreadCount, today: todayCount },
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching notifications", error: error.message });
  }
};

// POST /api/v1/admin/notifications/broadcast — send a notification to all users or a target set
export const broadcastNotification: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { title, message, type = "FEATURE_ANNOUNCEMENT", targetUserIds, targetAll = false } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    if (!title || !message) {
      res.status(400).json({ success: false, message: "title and message are required" });
      return;
    }

    let userIds: string[] = [];
    if (targetAll) {
      const users = await models.User.findAll({ attributes: ["id"], where: { isVerified: true } });
      userIds = users.map((u: any) => u.id);
    } else if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      userIds = targetUserIds;
    } else {
      res.status(400).json({ success: false, message: "Provide targetUserIds array or set targetAll=true" });
      return;
    }

    // Bulk insert notifications
    const notificationPayloads = userIds.map((uid: string) => ({
      userId: uid,
      type: type as NotificationType,
      data: { title, message, broadcastAt: new Date().toISOString() },
      isRead: false,
    }));

    await models.Notification.bulkCreate(notificationPayloads);

    // Real-time socket push — fire and forget
    const io = req.app.get("io");
    if (io) {
      userIds.forEach((uid: string) => {
        io.to(`user_${uid}`).emit("notification", {
          type,
          recipientId: uid,
          data: { title, message, broadcastAt: new Date().toISOString() },
        });
      });
    }

    res.status(200).json({
      success: true,
      message: `Broadcast sent to ${userIds.length} user(s)`,
      sentTo: userIds.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error broadcasting notification", error: error.message });
  }
};

// DELETE /api/v1/admin/notifications/:id — admin hard-delete any notification
export const deleteNotification: RequestHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const deleted = await models.Notification.destroy({ where: { id } });
    if (!deleted) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error deleting notification", error: error.message });
  }
};

// GET /api/v1/admin/notifications/types — list distinct notification types used
export const getNotificationTypes: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const types = await models.Notification.findAll({
      attributes: [[models.Notification.sequelize!.fn("DISTINCT", models.Notification.sequelize!.col("type")), "type"]],
      raw: true,
    });
    res.status(200).json({ success: true, data: types.map((t: any) => t.type) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching types", error: error.message });
  }
};

// PATCH /api/v1/admin/notifications/:id/read — mark a single notification as read
export const markNotificationRead: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const notification = await models.Notification.findByPk(id);
    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    await notification.update({ isRead: true });
    res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error marking notification as read", error: error.message });
  }
};

// PATCH /api/v1/admin/notifications/mark-all-read — mark all (or filtered) notifications as read
export const markAllNotificationsRead: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { userId, type } = req.query;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const whereClause: any = { isRead: false };
    if (userId) whereClause.userId = userId;
    if (type) whereClause.type = type;

    const [count] = await models.Notification.update({ isRead: true }, { where: whereClause });
    res.status(200).json({ success: true, message: `${count} notification(s) marked as read`, count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error marking notifications as read", error: error.message });
  }
};

export default { getAllNotifications, broadcastNotification, deleteNotification, getNotificationTypes, markNotificationRead, markAllNotificationsRead };
