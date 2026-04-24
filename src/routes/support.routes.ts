import { Router, RequestHandler } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createOrGetSupportChat,
  getSupportChat,
  getSupportChatMessages,
  sendSupportMessage,
  markSupportChatAsRead,
} from "../controllers/supportChat.controller";

const router = Router();

// All support chat routes require user authentication
router.use(authenticate);

// POST /api/v1/support/chat       — create or retrieve user's support chat
router.post("/chat", createOrGetSupportChat as RequestHandler);

// GET  /api/v1/support/chat       — get user's support chat info
router.get("/chat", getSupportChat as RequestHandler);

// GET  /api/v1/support/chat/:chatId/messages  — get messages for the chat
router.get("/chat/:chatId/messages", getSupportChatMessages as RequestHandler);

// POST /api/v1/support/chat/:chatId/messages — send a support message
router.post("/chat/:chatId/messages", sendSupportMessage as RequestHandler);

// PATCH /api/v1/support/chat/:chatId/read — mark all messages as read
router.patch("/chat/:chatId/read", markSupportChatAsRead as RequestHandler);

export default router;
