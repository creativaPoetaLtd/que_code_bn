import { Response, NextFunction, RequestHandler } from "express";
import { Transaction, QueryTypes, Op } from "sequelize";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";

/**
 * POST /api/v1/support/chat
 * Creates or retrieves the authenticated user's support chat (idempotent).
 * Uses a serializable transaction to prevent duplicate chats from race conditions.
 */
export const createOrGetSupportChat: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const result = await models.sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
      async (t) => {
        // Lock rows for this user to prevent concurrent inserts
        const existing = await models.ChatParticipant.findOne({
          where: { userId },
          include: [
            {
              model: models.Chat,
              as: "chat",
              where: { type: "support" },
              required: true,
            },
          ],
          order: [[{ model: models.Chat, as: "chat" }, "createdAt", "ASC"]],
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (existing) {
          const chatId = (existing as any).chatId;
          const chat = await models.Chat.findByPk(chatId, { transaction: t });
          return { chat, created: false };
        }

        const chat = await models.Chat.create(
          { isGroup: false, type: "support" } as any,
          { transaction: t }
        );
        await models.ChatParticipant.create(
          { chatId: chat.id, userId } as any,
          { transaction: t }
        );
        return { chat, created: true };
      }
    );

    const status = result.created ? 201 : 200;
    res.status(status).json({ success: true, data: result.chat });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/support/chat
 * Returns the authenticated user's support chat info.
 */
export const getSupportChat: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const participant = await models.ChatParticipant.findOne({
      where: { userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { type: "support" },
          required: true,
        },
      ],
      order: [[{ model: models.Chat, as: "chat" }, "createdAt", "ASC"]],
    });

    if (!participant) {
      res.status(404).json({ success: false, message: "No support chat found. Start a new one." });
      return;
    }

    const chatId = (participant as any).chatId;
    const chat = await models.Chat.findByPk(chatId);
    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/support/chat/:chatId/messages
 * Returns paginated messages for the user's support chat.
 */
export const getSupportChatMessages: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Verify this chat belongs to the user and is a support chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { type: "support" },
          required: true,
        },
      ],
    });

    if (!participant) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const messages = await models.ChatMessage.findAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
      limit: Number(limit),
      offset,
      include: [
        {
          model: models.User,
          as: "sender",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    res.json({ success: true, data: { chatId, messages } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/support/chat/:chatId/messages
 * Sends a support message from the authenticated user.
 */
export const sendSupportMessage: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const { content, messageType = "text" } = req.body as {
      content?: string;
      messageType?: string;
    };
    const models = req.app.get("models") as ReturnType<typeof Models>;

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Message content is required" });
      return;
    }

    // Verify this chat belongs to the user and is a support chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { type: "support" },
          required: true,
        },
      ],
    });

    if (!participant) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const message = await models.ChatMessage.create({
      chatId,
      senderId: userId,
      content: content.trim(),
      messageType,
      isEncrypted: false,
      status: "sent",
    } as any);

    const sender = await models.User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "email"],
    });

    const messageData = {
      ...message.toJSON(),
      sender,
    };

    const io = req.app.get("io");
    if (io) {
      io.to(`chat_${chatId}`).emit("new_message", messageData);
    }

    res.status(201).json({ success: true, data: messageData });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/support/chat/:chatId/read
 * Marks all messages in the support chat as read for the authenticated user.
 * Updates ChatParticipant.lastReadAt and bulk-updates ChatMessage.status.
 */
export const markSupportChatAsRead: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Verify this chat belongs to the user and is a support chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { type: "support" },
          required: true,
        },
      ],
    });

    if (!participant) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const now = new Date();

    // Update lastReadAt for this participant
    await models.ChatParticipant.update(
      { lastReadAt: now } as any,
      { where: { chatId, userId } }
    );

    // Bulk-mark messages from other senders as read
    await models.ChatMessage.update(
      { status: "read", readAt: now } as any,
      {
        where: {
          chatId,
          senderId: { [Op.ne]: userId },
          status: { [Op.ne]: "read" },
        } as any,
      }
    );

    res.json({ success: true, message: "Chat marked as read" });
  } catch (error) {
    next(error);
  }
};
