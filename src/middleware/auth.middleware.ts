// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Models from '../database/models';

declare module 'express-serve-static-core' {
    interface Request {
        user?: any; // Or use your specific User type
    }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    (async () => {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ message: 'No token provided' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
            const models = req.app.get('models') as ReturnType<typeof Models>;

            const user = await models.User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = user.get({ plain: true });
            next();
        } catch (error) {
            next(error);
        }
    })();
};