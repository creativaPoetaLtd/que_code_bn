import { Router, Request, Response, NextFunction } from 'express';
import { updateFCMToken, removeFCMToken } from '../controllers/fcmController';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.put('/token', authenticate, updateFCMToken as any);
router.delete('/token', authenticate, removeFCMToken as any);

export default router;