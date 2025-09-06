import express from "express";
import * as chatController from "../controllers/chatController";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Apply authentication middleware to all chat routes
router.use(authenticate);

// Create or get existing chat between two users
router.post("/", chatController.create_or_get_chat);

// Get all chats for the authenticated user
router.get("/", chatController.get_user_chats);

// Get messages for a specific chat with pagination
router.get("/:chatId/messages", chatController.get_chat_messages);

// Send a new message in a chat
router.post("/:chatId/messages", chatController.send_message);

// Mark messages in a chat as read
router.put("/:chatId/read", chatController.update_last_read);

export default router;
