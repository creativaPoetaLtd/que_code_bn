import express from "express";
import * as chatController from "../controllers/chatController";
import { authenticate } from "../middleware/auth.middleware";

const chatRouter = express.Router();

// Apply authentication middleware to all chat routes
chatRouter.use(authenticate);

// Create or get existing chat between two users
chatRouter.post(
  "/",
  (req, res, next) => {
    console.log("🔥 Chat POST route hit");
    next();
  },
  chatController.create_or_get_chat
);

// Get all chats for the authenticated user
chatRouter.get("/", chatController.get_user_chats);

// Get messages for a specific chat with pagination
chatRouter.get("/:chatId/messages", chatController.get_chat_messages);

// Send a new message in a chat
chatRouter.post("/:chatId/messages", chatController.send_message);

// Mark messages in a chat as read
chatRouter.put("/:chatId/read", chatController.update_last_read);

export default chatRouter;
