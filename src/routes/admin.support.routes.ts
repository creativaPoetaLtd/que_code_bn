import { Router, RequestHandler } from "express";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";
import {
  getAllSupportChats,
  joinSupportChat,
  getAdminSupportChatMessages,
  adminSendSupportMessage,
  markAdminSupportChatAsRead,
  getAdminSupportUnreadCount,
} from "../controllers/admin.support.controller";

const router = Router();
const guard = [
  authenticate as RequestHandler,
  requireRole("super_admin") as RequestHandler,
];

// GET  /api/v1/admin/support/chats                      — list all support chats
router.get("/chats", ...guard, getAllSupportChats);

// POST /api/v1/admin/support/chats/:chatId/join         — admin joins a support chat
router.post("/chats/:chatId/join", ...guard, joinSupportChat);

// GET  /api/v1/admin/support/chats/:chatId/messages     — get messages for a chat
router.get("/chats/:chatId/messages", ...guard, getAdminSupportChatMessages);

// POST /api/v1/admin/support/chats/:chatId/messages     — admin sends a message
router.post("/chats/:chatId/messages", ...guard, adminSendSupportMessage);

// GET  /api/v1/admin/support/unread-count               — total unread messages for header badge
// NOTE: this route must come before /:chatId routes to avoid param collision
router.get("/unread-count", ...guard, getAdminSupportUnreadCount);

// PATCH /api/v1/admin/support/chats/:chatId/read        — mark chat messages as read
router.patch("/chats/:chatId/read", ...guard, markAdminSupportChatAsRead);

export default router;
