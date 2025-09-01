// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import database_models from '../database/config/db.config';

const { User } = database_models;

declare module 'express-serve-static-core' {
    interface Request {
        user?: any; // Or use your specific User type
    }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    (async () => {
        try {
            let token = req.header('Authorization')?.replace('Bearer ', '');
            
            if (!token && req.cookies?.token) {
                try {
                    const cookieData = typeof req.cookies.token === 'string' 
                        ? JSON.parse(req.cookies.token) 
                        : req.cookies.token;
                    token = cookieData.value || cookieData;
                } catch (e) {
                    token = req.cookies.token;
                }
            }

            if (!token) {
                return res.status(401).json({ message: 'No token provided' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

            const user = await User.findByPk(decoded.id, {
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