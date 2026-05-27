import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import multer from "multer";
import {
  createOrGetSecureDM,
  getMySecureDevices,
  getPublicDeviceBundlesForUser,
  getSecureChatMessages,
  markSecureChatAsRead,
  registerSecureDevice,
  revokeMySecureDevice,
  sendSecureChatMessage,
  uploadSecureChatMedia,
} from "../controllers/e2ee.controller";

const router = Router();
const secureMediaUpload = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: 110 * 1024 * 1024,
    files: 1,
  },
});

router.use(authenticate as RequestHandler);

router.get("/devices", getMySecureDevices as RequestHandler);
router.post("/devices/register", registerSecureDevice as RequestHandler);
router.delete("/devices/:deviceId", revokeMySecureDevice as RequestHandler);
router.post("/dms", createOrGetSecureDM as RequestHandler);
router.get("/users/:userId/device-bundles", getPublicDeviceBundlesForUser as RequestHandler);
router.get("/chats/:chatId/messages", getSecureChatMessages as RequestHandler);
router.post("/chats/:chatId/messages", sendSecureChatMessage as RequestHandler);
router.post(
  "/chats/:chatId/media",
  secureMediaUpload.single("file"),
  uploadSecureChatMedia as RequestHandler,
);
router.post("/chats/:chatId/read", markSecureChatAsRead as RequestHandler);

export default router;
