import { Router } from "express";
import {
  getGroupChat,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  updateChatSettings,
  getChatSettings,
  uploadFile
} from "../controllers/chatController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/groups/:groupId/chat", authenticate, getGroupChat);

router.get("/groups/:groupId/chat/messages", authenticate, getMessages);

router.post("/groups/:groupId/chat/messages", authenticate, sendMessage);

router.put("/groups/:groupId/chat/messages/:messageId", authenticate, editMessage);

router.delete("/groups/:groupId/chat/messages/:messageId", authenticate, deleteMessage);

router.post("/groups/:groupId/chat/read", authenticate, markAsRead);

router.get("/groups/:groupId/chat/settings", authenticate, getChatSettings);

router.put("/groups/:groupId/chat/settings", authenticate, updateChatSettings);

router.post("/groups/:groupId/chat/upload", authenticate, uploadFile);

export default router;