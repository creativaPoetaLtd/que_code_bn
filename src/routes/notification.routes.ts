import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as notificationController from "../controllers/notificationController";

const router = Router();
router.use(authenticate);

router.get('/', notificationController.getNotifications as RequestHandler);
router.patch('/:notificationId/read', notificationController.markNotificationRead as RequestHandler);

export default router;
