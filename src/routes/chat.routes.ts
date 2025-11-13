import { Router, RequestHandler } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as chatController from "../controllers/chatController";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Get user's chats (both DMs and group chats)
router.get("/", chatController.getUserChats as RequestHandler);

// Create or get DM chat
router.post("/dm", chatController.createOrGetDMChat as RequestHandler);

// Get chat messages
router.get("/:chatId/messages", chatController.getChatMessages as RequestHandler);

// Send message (HTTP endpoint for non-realtime scenarios)
router.post("/:chatId/messages", chatController.sendMessage as RequestHandler);

// Mark messages as read
router.post("/:chatId/read", chatController.markMessagesAsRead as RequestHandler);

// Get online status of chat participants
router.get("/:chatId/participants/status", chatController.getChatParticipantsStatus as RequestHandler);

// Create group chat
router.post("/group", chatController.createGroupChat as RequestHandler);

// Join or create a group's chat
router.post("/group/:groupId/join", chatController.joinGroupChat as RequestHandler);

// Delete chat
router.delete("/:chatId", chatController.deleteChat as RequestHandler);

// Initialize user encryption keys
router.post("/encryption/init", chatController.initializeUserEncryption as RequestHandler);

export default router;