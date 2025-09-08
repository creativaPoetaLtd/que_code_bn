import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../utils/notificationService";
import Models from "../database/models";

// Notification endpoints
const getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const { notifications, unreadCount, totalCount } = await getUserNotifications(req.app, req.user.id, page, limit);

        res.json({
            notifications,
            unreadCount,
            totalCount,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

const markNotificationRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { notificationId } = req.params;
        const success = await markNotificationAsRead(req.app, notificationId, req.user.id);
        if (success) {
            res.json({ message: 'Notification marked as read' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        next(error);
    }
};

const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const count = await markAllNotificationsAsRead(req.app, req.user.id);
        res.json({
            message: `${count} notifications marked as read`,
            count
        });
    } catch (error) {
        next(error);
    }
};

const deleteNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { notificationId } = req.params;
        const models = req.app.get("models") as ReturnType<typeof Models>;

        const result = await models.Notification.destroy({
            where: {
                id: notificationId,
                userId: req.user.id
            }
        });

        if (result > 0) {
            res.json({ message: 'Notification deleted successfully' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        next(error);
    }
};

const getUnreadCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const models = req.app.get("models") as ReturnType<typeof Models>;
        const unreadCount = await models.Notification.count({
            where: { userId: req.user.id, isRead: false }
        });

        res.json({ unreadCount });
    } catch (error) {
        next(error);
    }
};

export {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    getUnreadCount
}