import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import { getUserNotifications, markNotificationAsRead } from "../utils/notificationService";

// Notification endpoints
const getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { notifications, unreadCount } = await getUserNotifications(req.app, req.user.id);
        res.json({ notifications, unreadCount });
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

export {
    getNotifications,
    markNotificationRead
}