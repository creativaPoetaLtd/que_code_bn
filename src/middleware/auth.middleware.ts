// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import database_models from '../database/config/db.config';
import { UserModelAttributes, OrganizationModelAttributes } from '../types/model';

const { User, Organization } = database_models;

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

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { 
                id: string; 
                accountType?: string; 
            };

            let entity = null;

            // Check if it's an organization token
            if (decoded.accountType === 'organization') {
                entity = await Organization.findByPk(decoded.id);
            } else {
                // Default to user lookup
                entity = await User.findByPk(decoded.id, {
                    attributes: { exclude: ['password'] }
                });
            }

            if (!entity) {
                return res.status(401).json({ 
                    message: decoded.accountType === 'organization' ? 'Organization not found' : 'User not found' 
                });
            }

            req.user = entity.get({ plain: true }) as any;
            next();
        } catch (error) {
            next(error);
        }
    })();
};