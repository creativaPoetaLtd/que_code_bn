import { RequestHandler } from "express";
import { QueryTypes, literal, Op } from "sequelize";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import ChatService from "../services/chatService";
import fs from "fs";

/**
 * GET /api/v1/admin/support/chats
 * Returns all support chats (initiated by regular users) with participant info,
 * the last message, and unread message count per chat for the requesting admin.
 * Sorted by: chats with unread messages first (most recent unread at top), then by updatedAt.
 */
export const getAllSupportChats: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    // Only return one support chat per regular user (the earliest created), excluding duplicates
    // and excluding chats that have no regular-user participants.
    // IMPORTANT: the subquery must JOIN to "Chats" and filter type='support' so that
    // DISTINCT ON only considers support-chat participant rows. Without this, users
    // who have older DM/group chats would have their DM chatId returned by
    // DISTINCT ON (oldest createdAt), causing the outer type='support' filter to miss them.
    const { count, rows: chats } = await models.Chat.findAndCountAll({
      where: {
        type: "support",
        id: {
          [Op.in]: literal(`(
            SELECT DISTINCT ON (cp."userId") cp."chatId"
            FROM "ChatParticipants" cp
            INNER JOIN "Chats" ch ON ch."id" = cp."chatId" AND ch."type" = 'support'
            WHERE NOT EXISTS (
              SELECT 1 FROM "UserRoles" ur
              INNER JOIN "Roles" r ON r."id" = ur."roleId"
              WHERE ur."userId" = cp."userId"
                AND r."name" IN ('admin', 'super_admin')
            )
            ORDER BY cp."userId", cp."createdAt" ASC
          )`),
        },
      },
      include: [
        {
          model: models.ChatParticipant,
          as: "participants",
          include: [
            {
              model: models.User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: Number(limit),
      offset,
      distinct: true,
    });

    const chatIds = chats.map((c: any) => c.id);
    let lastMessageMap: Record<string, any> = {};
    let unreadCountMap: Record<string, { unreadCount: number; lastUnreadAt: string | null }> = {};

    if (chatIds.length > 0) {
      // Fetch last message per chat
      const lastMessages: any[] = await models.sequelize.query(
        `SELECT DISTINCT ON (cm."chatId")
           cm."id", cm."chatId", cm."content", cm."createdAt",
           u."id" AS "senderId", u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
         FROM "ChatMessages" cm
         LEFT JOIN "Users" u ON u."id" = cm."senderId"
         WHERE cm."chatId" IN (:chatIds)
         ORDER BY cm."chatId", cm."createdAt" DESC`,
        { replacements: { chatIds }, type: QueryTypes.SELECT }
      );
      for (const msg of lastMessages) {
        lastMessageMap[msg.chatId] = {
          id: msg.id,
          chatId: msg.chatId,
          content: msg.content,
          createdAt: msg.createdAt,
          sender: msg.senderId
            ? { id: msg.senderId, firstName: msg.senderFirstName, lastName: msg.senderLastName }
            : null,
        };
      }

      // Fetch unread message counts per chat for this admin
      // Unread = messages NOT sent by this admin, after admin's lastReadAt (or all if never read)
      const unreadRows: any[] = await models.sequelize.query(
        `SELECT
           cm."chatId",
           COUNT(*) AS "unreadCount",
           MAX(cm."createdAt") AS "lastUnreadAt"
         FROM "ChatMessages" cm
         WHERE cm."chatId" IN (:chatIds)
           AND cm."senderId" != :adminId
           AND (
             NOT EXISTS (
               SELECT 1 FROM "ChatParticipants" cp
               WHERE cp."chatId" = cm."chatId" AND cp."userId" = :adminId
             )
             OR EXISTS (
               SELECT 1 FROM "ChatParticipants" cp
               WHERE cp."chatId" = cm."chatId" AND cp."userId" = :adminId
                 AND (cp."lastReadAt" IS NULL OR cm."createdAt" > cp."lastReadAt")
             )
           )
         GROUP BY cm."chatId"`,
        { replacements: { chatIds, adminId }, type: QueryTypes.SELECT }
      );
      for (const row of unreadRows) {
        unreadCountMap[row.chatId] = {
          unreadCount: Number(row.unreadCount),
          lastUnreadAt: row.lastUnreadAt ?? null,
        };
      }
    }

    // Build result and sort: unread chats first (by most recent unread), then by updatedAt
    const result = chats
      .map((chat: any) => {
        const chatJson = chat.toJSON();
        // Exclude the admin's own participant entry from the list so the frontend
        // can reliably identify which participant is the regular user.
        const participants = (chatJson.participants ?? []).filter(
          (p: any) => p.userId !== adminId
        );
        return {
          ...chatJson,
          participants,
          lastMessage: lastMessageMap[chat.id] ?? null,
          unreadCount: unreadCountMap[chat.id]?.unreadCount ?? 0,
          lastUnreadAt: unreadCountMap[chat.id]?.lastUnreadAt ?? null,
        };
      })
      .sort((a: any, b: any) => {
        // Chats with unread messages float to top, sorted by most recent unread
        if (a.lastUnreadAt && b.lastUnreadAt) {
          return new Date(b.lastUnreadAt).getTime() - new Date(a.lastUnreadAt).getTime();
        }
        if (a.lastUnreadAt) return -1;
        if (b.lastUnreadAt) return 1;
        // Both have no unread — sort by updatedAt
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    const totalUnreadMessages = Object.values(unreadCountMap).reduce(
      (sum, row) => sum + row.unreadCount,
      0
    );

    res.json({
      success: true,
      data: {
        chats: result,
        total: count,
        totalUnreadMessages,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/support/chats/:chatId/join
 * Adds the admin as a participant in the support chat (idempotent).
 */
export const joinSupportChat: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const chat = await models.Chat.findOne({ where: { id: chatId, type: "support" } });
    if (!chat) {
      res.status(404).json({ success: false, message: "Support chat not found" });
      return;
    }

    const [participant, created] = await models.ChatParticipant.findOrCreate({
      where: { chatId, userId: adminId },
      defaults: { chatId, userId: adminId } as any,
    });

    res.json({ success: true, data: participant, joined: created });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/support/chats/:chatId/messages
 * Returns paginated messages for a support chat.
 */
export const getAdminSupportChatMessages: RequestHandler = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const adminId = (req as any as AuthenticatedRequest).user.id;

    const chat = await models.Chat.findOne({ where: { id: chatId, type: "support" } });
    if (!chat) {
      res.status(404).json({ success: false, message: "Support chat not found" });
      return;
    }

    // Auto-join the admin as a participant when they open the chat.
    // This is idempotent — findOrCreate does nothing if already joined.
    // Means the frontend never needs a separate explicit join step.
    await models.ChatParticipant.findOrCreate({
      where: { chatId, userId: adminId },
      defaults: { chatId, userId: adminId } as any,
    });

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
 * POST /api/v1/admin/support/chats/:chatId/messages
 * Admin sends a message in a support chat. Auto-joins if not a participant.
 * Emits socket event to notify the user in real-time.
 */
export const adminSendSupportMessage: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const { content } = req.body as { content: string };
    const models = req.app.get("models") as ReturnType<typeof Models>;

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Message content is required" });
      return;
    }

    const chat = await models.Chat.findOne({ where: { id: chatId, type: "support" } });
    if (!chat) {
      res.status(404).json({ success: false, message: "Support chat not found" });
      return;
    }

    // Ensure admin is a participant (auto-join)
    await models.ChatParticipant.findOrCreate({
      where: { chatId, userId: adminId },
      defaults: { chatId, userId: adminId } as any,
    });

    const message = await models.ChatMessage.create({
      chatId,
      senderId: adminId,
      content: content.trim(),
      messageType: "text",
      isEncrypted: false,
      status: "sent",
    } as any);

    // Include sender info
    const sender = await models.User.findByPk(adminId, {
      attributes: ["id", "firstName", "lastName", "email"],
    });

    const messageData = { ...message.toJSON(), sender };

    // Emit socket event to the chat room so the user receives it in real-time
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
 * PATCH /api/v1/admin/support/chats/:chatId/read
 * Marks all user messages in the support chat as read for the requesting admin.
 */
export const markAdminSupportChatAsRead: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const chat = await models.Chat.findOne({ where: { id: chatId, type: "support" } });
    if (!chat) {
      res.status(404).json({ success: false, message: "Support chat not found" });
      return;
    }

    const now = new Date();

    // Ensure admin is a participant, then update lastReadAt
    await models.ChatParticipant.findOrCreate({
      where: { chatId, userId: adminId },
      defaults: { chatId, userId: adminId, lastReadAt: now } as any,
    });

    await models.ChatParticipant.update(
      { lastReadAt: now } as any,
      { where: { chatId, userId: adminId } }
    );

    // Bulk-mark messages from non-admin senders as read
    await models.ChatMessage.update(
      { status: "read", readAt: now } as any,
      {
        where: {
          chatId,
          senderId: { [Op.ne]: adminId },
          status: { [Op.ne]: "read" },
        } as any,
      }
    );

    res.json({ success: true, message: "Chat marked as read" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/support/unread-count
 * Returns the total number of unread user messages across all support chats for this admin.
 * Lightweight endpoint for the header badge.
 */
export const getAdminSupportUnreadCount: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // one chat per regular user (earliest created), so the badge count matches
    // exactly what is shown in the admin support list.
    const rows: any[] = await models.sequelize.query(
      `SELECT COUNT(*) AS "totalUnread"
       FROM "ChatMessages" cm
       INNER JOIN "Chats" ch ON ch."id" = cm."chatId" AND ch."type" = 'support'
       WHERE cm."senderId" != :adminId
         AND cm."chatId" IN (
           SELECT DISTINCT ON (cp."userId") cp."chatId"
           FROM "ChatParticipants" cp
           INNER JOIN "Chats" ch2 ON ch2."id" = cp."chatId" AND ch2."type" = 'support'
           WHERE NOT EXISTS (
             SELECT 1 FROM "UserRoles" ur
             INNER JOIN "Roles" r ON r."id" = ur."roleId"
             WHERE ur."userId" = cp."userId"
               AND r."name" IN ('admin', 'super_admin')
           )
           ORDER BY cp."userId", cp."createdAt" ASC
         )
         AND (
           NOT EXISTS (
             SELECT 1 FROM "ChatParticipants" cp
             WHERE cp."chatId" = cm."chatId" AND cp."userId" = :adminId
           )
           OR EXISTS (
             SELECT 1 FROM "ChatParticipants" cp
             WHERE cp."chatId" = cm."chatId" AND cp."userId" = :adminId
               AND (cp."lastReadAt" IS NULL OR cm."createdAt" > cp."lastReadAt")
           )
         )`,
      { replacements: { adminId }, type: QueryTypes.SELECT }
    );

    const totalUnread = Number(rows[0]?.totalUnread ?? 0);
    res.json({ success: true, data: { totalUnread } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/support/chats/:chatId/media
 * Admin sends a media file (image, document, etc.) in a support chat.
 */
export const adminSendSupportMediaMessage: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as any as AuthenticatedRequest).user.id;
    const { chatId } = req.params;
    const { caption } = req.body as { caption?: string };
    const file = (req as any).file as Express.Multer.File | undefined;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    if (!file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }

    // Ensure admin has joined (or join now)
    await models.ChatParticipant.findOrCreate({
      where: { chatId, userId: adminId },
      defaults: { chatId, userId: adminId, role: "admin", lastReadAt: new Date() } as any,
    });

    const io = req.app.get("io");
    const chatService = ChatService.getInstance();

    const message = await chatService.sendMediaMessage(
      adminId, chatId, file, caption || "", models, io, req.app
    );

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        chatId,
        content: message.content,
        messageType: message.messageType,
        status: message.status,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        fileSize: message.fileSize,
        thumbnailUrl: message.thumbnailUrl,
        fileName: message.fileName,
        mimeType: message.mimeType,
        duration: message.duration,
        createdAt: message.createdAt,
        sender: message.get("sender"),
      },
    });
  } catch (error) {
    if ((req as any).file && fs.existsSync((req as any).file.path)) {
      fs.unlinkSync((req as any).file.path);
    }
    next(error);
  }
};
