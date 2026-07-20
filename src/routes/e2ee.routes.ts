import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createOrGetSecureDM,
  getMySecureDevices,
  getPublicDeviceBundlesForUser,
  getSecureChatMessages,
  markSecureChatAsRead,
  registerSecureDevice,
  sendSecureChatMessage,
} from "../controllers/e2ee.controller";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/devices", getMySecureDevices as RequestHandler);
router.post("/devices/register", registerSecureDevice as RequestHandler);
router.post("/dms", createOrGetSecureDM as RequestHandler);
router.get("/users/:userId/device-bundles", getPublicDeviceBundlesForUser as RequestHandler);
router.get("/chats/:chatId/messages", getSecureChatMessages as RequestHandler);
router.post("/chats/:chatId/messages", sendSecureChatMessage as RequestHandler);
router.post("/chats/:chatId/read", markSecureChatAsRead as RequestHandler);

export default router;
