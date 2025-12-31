import { Request, Response, NextFunction } from 'express';
import Models from '../database/models';
import { AuthenticatedRequest } from '../types/requests';

export const updateFCMToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user?.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    await models.User.update(
      { fcmToken } as any,
      { where: { id: userId } }
    );

    res.status(200).json({ message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    next(error);
  }
};

export const removeFCMToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await models.User.update(
      { fcmToken: null } as any,
      { where: { id: userId } }
    );

    res.status(200).json({ message: 'FCM token removed successfully' });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    next(error);
  }
};