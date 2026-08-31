import { Router, RequestHandler } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as chatController from "../controllers/chatController";
import * as chatMoneyController from "../controllers/chatMoneyController";

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

// Pin anything in the conversation, and read the pinned set
router.get("/:chatId/pins", chatController.getPinnedMessages as RequestHandler);
router.post("/:chatId/messages/:messageId/pin", chatController.pinMessage as RequestHandler);
router.delete("/:chatId/messages/:messageId/pin", chatController.unpinMessage as RequestHandler);

// Edit the text of a message you sent (plain chats; secure chats use /e2ee)
router.patch("/:chatId/messages/:messageId", chatController.editMessage as RequestHandler);

// Delete a message you sent (tombstone, visible to everyone in the chat)
router.delete("/:chatId/messages/:messageId", chatController.deleteMessage as RequestHandler);

// Send media message (images, videos, audio, documents)
router.post("/:chatId/media", chatController.upload.single('file'), chatController.sendMediaMessage as RequestHandler);

// Send money in chat
router.post("/:chatId/send-money", chatMoneyController.sendMoneyInChat as RequestHandler);

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