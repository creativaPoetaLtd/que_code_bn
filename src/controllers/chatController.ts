import { Request, Response } from "express";
import { Server as SocketIOServer } from "socket.io";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ChatAttributes,
  ChatCreationAttributes,
  ChatMessageAttributes,
  ChatMessageCreationAttributes,
  ChatParticipantAttributes,
  ChatParticipantCreationAttributes,
  UserModelAttributes,
  ContactAttributes,
} from "../types/model";
import { Op } from "sequelize";
import { are_users_contacts } from "./contactController";

// Helper function to create or get chat between two users (can be used internally)
export const create_or_get_chat_internal = async (
  userId1: string,
  userId2: string
): Promise<ChatAttributes | null> => {
  try {
    console.log("🔍 Internal chat creation between:", userId1, "and", userId2);

    if (!userId1 || !userId2) {
      throw new Error("Both user IDs are required");
    }

    if (userId1 === userId2) {
      throw new Error("Cannot create chat with yourself");
    }

    // Check if both users exist
    const [user1, user2] = await Promise.all([
      read_function<UserModelAttributes>("User", "findOne", {
        where: { id: userId1 },
        attributes: ["id", "firstName", "lastName", "email"],
      }),
      read_function<UserModelAttributes>("User", "findOne", {
        where: { id: userId2 },
        attributes: ["id", "firstName", "lastName", "email"],
      }),
    ]);

    if (!user1 || !user2) {
      throw new Error("One or both users not found");
    }

    // Check if users are contacts (friends)
    const areContacts = await are_users_contacts(userId1, userId2);
    if (!areContacts) {
      throw new Error("Users are not contacts");
    }

    // Check if chat already exists
    const existingChat = await read_function<ChatAttributes>(
      "Chat",
      "findOne",
      {
        include: [
          {
            model: database_models.ChatParticipant,
            as: "participants",
            where: {
              userId: { [Op.in]: [userId1, userId2] },
            },
            required: true,
          },
        ],
        where: {
          isGroup: false,
        },
      }
    );

    if (existingChat) {
      console.log("✅ Found existing chat:", existingChat.id);
      return existingChat;
    }

    // Create new chat
    const chatData: ChatCreationAttributes = {
      isGroup: false,
    };

    const newChat = await insert_function<ChatAttributes>(
      "Chat",
      "create",
      chatData
    );

    console.log("✅ Chat created:", newChat.id);

    // Add both users as participants
    const participantData1: ChatParticipantCreationAttributes = {
      chatId: newChat.id,
      userId: userId1,
      joinedAt: new Date(),
    };

    const participantData2: ChatParticipantCreationAttributes = {
      chatId: newChat.id,
      userId: userId2,
      joinedAt: new Date(),
    };

    await Promise.all([
      insert_function<ChatParticipantAttributes>(
        "ChatParticipant",
        "create",
        participantData1
      ),
      insert_function<ChatParticipantAttributes>(
        "ChatParticipant",
        "create",
        participantData2
      ),
    ]);

    console.log("✅ Participants added to chat");
    return newChat;
  } catch (error: any) {
    console.error("❌ Internal chat creation error:", error.message);
    throw error;
  }
};

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

// Create or get existing chat between two users
export const create_or_get_chat = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get userId1 from authenticated user
    const userId1 = req.user?.id;
    const { userId2 } = req.body;

    console.log("🔍 Authenticated user:", req.user);

    if (!userId1) {
      console.error("❌ Authenticated user ID not found in request:", req.user);
      res.status(401).json({ message: "Authenticated user ID not found" });
      return;
    }

    console.log("🔍 Creating/getting chat between:", userId1, "and", userId2);

    try {
      const chat = await create_or_get_chat_internal(userId1, userId2);
      if (!chat) {
        throw new Error("Failed to create or find chat");
      }

      const chatWithDetails = await getChatWithDetails(chat.id);

      res.status(200).json({
        message: "Chat found/created successfully",
        data: chatWithDetails,
        isNew: false, // Since we're reusing the internal function, we'll keep this simple
      });
    } catch (error: any) {
      if (error.message === "Both user IDs are required") {
        res.status(400).json({ message: error.message });
      } else if (error.message === "Cannot create chat with yourself") {
        res.status(400).json({ message: error.message });
      } else if (error.message === "One or both users not found") {
        res.status(404).json({ message: error.message });
      } else if (error.message === "Users are not contacts") {
        res.status(403).json({
          message:
            "You can only chat with users who are in your contacts. Please send them a friend invitation first.",
        });
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  } catch (error: any) {
    console.error("❌ Create/get chat error:", error.message);
    res.status(500).json({
      message: "An error occurred while creating/getting chat",
      error: error.message,
    });
  }
};

// Get chat details with participants and recent messages
const getChatWithDetails = async (chatId: string) => {
  const chat = await read_function<ChatAttributes>("Chat", "findOne", {
    where: { id: chatId },
    include: [
      {
        model: database_models.ChatParticipant,
        as: "participants",
        include: [
          {
            model: database_models.User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      },
      {
        model: database_models.ChatMessage,
        as: "messages",
        limit: 50,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: database_models.User,
            as: "sender",
            attributes: ["id", "firstName", "lastName"],
          },
        ],
      },
    ],
  });

  return isSequelizeInstance(chat) ? chat.get({ plain: true }) : chat;
};

// Get user's chats
export const get_user_chats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get authenticated user's ID
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Authenticated user ID not found" });
      return;
    }

    console.log("🔍 Getting chats for user:", userId);

    // First get chat IDs where user is a participant
    const userChats = await read_function<ChatParticipantAttributes[]>(
      "ChatParticipant",
      "findAll",
      {
        where: { userId },
        attributes: ["chatId"],
      }
    );

    const chatIds = userChats.map((uc) =>
      isSequelizeInstance(uc) ? uc.get("chatId") : uc.chatId
    );

    if (chatIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    // Then get full chat details including ALL participants
    const chats = await read_function<ChatAttributes[]>("Chat", "findAll", {
      where: { id: { [Op.in]: chatIds } },
      include: [
        {
          model: database_models.ChatParticipant,
          as: "participants",
          // Remove the where clause to get ALL participants
          include: [
            {
              model: database_models.User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        },
        {
          model: database_models.ChatMessage,
          as: "messages",
          limit: 1,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: database_models.User,
              as: "sender",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const plainChats = Array.isArray(chats)
      ? chats.map((chat) =>
          isSequelizeInstance(chat) ? chat.get({ plain: true }) : chat
        )
      : [];

    console.log(`✅ Found ${plainChats.length} chats for user`);

    res.status(200).json({
      message: "Chats retrieved successfully",
      data: plainChats,
    });
  } catch (error: any) {
    console.error("❌ Get user chats error:", error.message);
    res.status(500).json({
      message: "An error occurred while retrieving chats",
      error: error.message,
    });
  }
};

// Get chat messages
export const get_chat_messages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log("🔍 Getting messages for chat:", chatId);

    const offset = (Number(page) - 1) * Number(limit);

    const messages = await read_function<ChatMessageAttributes[]>(
      "ChatMessage",
      "findAll",
      {
        where: { chatId },
        include: [
          {
            model: database_models.User,
            as: "sender",
            attributes: ["id", "firstName", "lastName"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: Number(limit),
        offset: offset,
      }
    );

    const plainMessages = Array.isArray(messages)
      ? messages
          .map((msg) =>
            isSequelizeInstance(msg) ? msg.get({ plain: true }) : msg
          )
          .reverse()
      : [];

    console.log(`✅ Found ${plainMessages.length} messages for chat`);

    res.status(200).json({
      message: "Messages retrieved successfully",
      data: plainMessages,
    });
  } catch (error: any) {
    console.error("❌ Get chat messages error:", error.message);
    res.status(500).json({
      message: "An error occurred while retrieving messages",
      error: error.message,
    });
  }
};

// Send message (used by REST API, real-time sending via Socket.IO)
export const send_message = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { chatId, senderId, content, messageType = "text" } = req.body;

    console.log("📤 Sending message to chat:", chatId);

    if (!chatId || !senderId || !content) {
      res
        .status(400)
        .json({ message: "Chat ID, sender ID, and content are required" });
      return;
    }

    // Verify chat exists and user is participant
    const chat = await read_function<ChatAttributes>("Chat", "findOne", {
      where: { id: chatId },
      include: [
        {
          model: database_models.ChatParticipant,
          as: "participants",
          where: { userId: senderId },
        },
      ],
    });

    if (!chat) {
      res
        .status(404)
        .json({ message: "Chat not found or user not participant" });
      return;
    }

    // Create message
    const messageData: ChatMessageCreationAttributes = {
      chatId,
      senderId,
      content,
      messageType: messageType as "text" | "image" | "file" | "money",
    };

    const newMessage = await insert_function<ChatMessageAttributes>(
      "ChatMessage",
      "create",
      messageData
    );

    // Get message with sender details
    const messageWithSender = await read_function<ChatMessageAttributes>(
      "ChatMessage",
      "findOne",
      {
        where: { id: newMessage.id },
        include: [
          {
            model: database_models.User,
            as: "sender",
            attributes: ["id", "firstName", "lastName"],
          },
        ],
      }
    );

    const plainMessage = isSequelizeInstance(messageWithSender)
      ? messageWithSender.get({ plain: true })
      : messageWithSender;

    // Update chat's updatedAt timestamp
    await insert_function<ChatAttributes>(
      "Chat",
      "update",
      { updatedAt: new Date() },
      { where: { id: chatId } }
    );

    console.log("✅ Message sent successfully");

    res.status(201).json({
      message: "Message sent successfully",
      data: plainMessage,
    });
  } catch (error: any) {
    console.error("❌ Send message error:", error.message);
    res.status(500).json({
      message: "An error occurred while sending message",
      error: error.message,
    });
  }
};

// Update last read timestamp
export const update_last_read = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { chatId, userId } = req.body;

    console.log("📖 Updating last read for user:", userId, "in chat:", chatId);

    await insert_function<ChatParticipantAttributes>(
      "ChatParticipant",
      "update",
      { lastReadAt: new Date() },
      { where: { chatId, userId } }
    );

    console.log("✅ Last read updated successfully");

    res.status(200).json({
      message: "Last read updated successfully",
    });
  } catch (error: any) {
    console.error("❌ Update last read error:", error.message);
    res.status(500).json({
      message: "An error occurred while updating last read",
      error: error.message,
    });
  }
};

export default {
  create_or_get_chat,
  get_user_chats,
  get_chat_messages,
  send_message,
  update_last_read,
};
