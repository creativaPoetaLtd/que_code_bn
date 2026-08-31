import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import { Op } from "sequelize";
import { sequelizeConnection } from "../database/config/db.config";
import ChatService from "../services/chatService";
import multer from "multer";
import path from "path";
import fs from "fs";
import { SECURE_DM_PROTOCOL_VERSION, supportsSecureDmBetweenUsers } from "../services/e2eeMessage.service";

// Get user's chats (both DMs and group chats)
export const getUserChats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const chatIncludes = (chatAttributes: string[]) => [
      {
        model: models.Chat,
        as: "chat",
        attributes: chatAttributes,
        include: [
          {
            model: models.ChatParticipant,
            as: "participants",
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email", "isOnline", "lastSeen"],
                include: [
                  {
                    model: models.Profile,
                    as: "profile",
                    attributes: ["profileImage"]
                  }
                ]
              }
            ]
          },
          {
            model: models.ChatMessage,
            as: "messages",
            limit: 1,
            order: [["createdAt", "DESC"]],
            include: [
              {
                model: models.User,
                as: "sender",
                attributes: ["firstName", "lastName"]
              }
            ]
          },
          {
            model: models.Group,
            as: "group",
            attributes: ["id", "name", "description", "profilePictureUrl", "memberCount"]
          }
        ]
      }
    ];

    const loadChats = (chatAttributes: string[]) => models.ChatParticipant.findAll({
      where: { userId },
      include: chatIncludes(chatAttributes) as any
    });

    let chats;
    try {
      chats = await loadChats(['id', 'isGroup', 'groupId', 'type', 'securityMode', 'protocolVersion', 'createdAt', 'updatedAt']);
    } catch (error: any) {
      const missingSecureChatColumns =
        error?.parent?.code === "42703" &&
        ["chat.securityMode", "chat.protocolVersion"].some((column) =>
          String(error?.parent?.message || error?.message || "").includes(column)
        );

      if (!missingSecureChatColumns) {
        throw error;
      }

      console.warn("Chats table is missing E2EE metadata columns; loading chats in legacy compatibility mode.");
      chats = await loadChats(['id', 'isGroup', 'groupId', 'type', 'createdAt', 'updatedAt']);
    }

    // Deduplicate by chatId — a user may have multiple ChatParticipant rows for
    // the same chat (e.g. they joined both as a regular user and as admin in a
    // support chat). Keep only the first occurrence per chatId.
    const seenChatIds = new Set<string>();
    const uniqueChats = chats.filter((cp) => {
      const chatId = (cp.get("chat") as any)?.id;
      if (!chatId || seenChatIds.has(chatId)) return false;
      seenChatIds.add(chatId);
      return true;
    });

    // Sort chats by latest message timestamp
    const sortedChats = uniqueChats.sort((a, b) => {
      const aChat = a.get("chat") as any;
      const bChat = b.get("chat") as any;

      const aLatestMessage = aChat.messages && aChat.messages.length > 0 ? aChat.messages[0] : null;
      const bLatestMessage = bChat.messages && bChat.messages.length > 0 ? bChat.messages[0] : null;

      if (!aLatestMessage && !bLatestMessage) return 0;
      if (!aLatestMessage) return 1;
      if (!bLatestMessage) return -1;

      return new Date(bLatestMessage.createdAt).getTime() - new Date(aLatestMessage.createdAt).getTime();
    });

    // If the DB contains multiple support Chat rows for this user (legacy duplicates
    // created before idempotency was enforced), keep only the most active one.
    // Since the array is already sorted by latest message DESC, the first support
    // chat encountered is the most active — drop any subsequent ones.
    let supportChatSeen = false;
    const finalChats = sortedChats.filter((cp) => {
      const chat = (cp.get("chat") as any);
      if (chat?.type === "support") {
        if (supportChatSeen) return false;
        supportChatSeen = true;
      }
      return true;
    });

    // Calculate unread counts for all chats in parallel
    const unreadCounts = await Promise.all(
      finalChats.map(async (chatParticipant) => {
        const chat = chatParticipant.get("chat") as any;
        const lastReadAt = (chatParticipant as any).lastReadAt;

        const whereClause: any = {
          chatId: chat.id,
          senderId: { [Op.ne]: userId }
        };

        if (lastReadAt) {
          whereClause.createdAt = { [Op.gt]: lastReadAt };
        }

        const count = await models.ChatMessage.count({ where: whereClause });
        return { chatId: chat.id, unreadCount: count };
      })
    );

    const unreadCountMap = unreadCounts.reduce((acc, { chatId, unreadCount }) => {
      acc[chatId] = unreadCount;
      return acc;
    }, {} as Record<string, number>);

    // Which DM partners have a visible gallery. Resolved once for the whole list -
    // the alternative, a lookup per avatar, would be a query per conversation.
    const dmPartnerIds = Array.from(
      new Set(
        finalChats
          .map((chatParticipant) => {
            const chatData = chatParticipant.get("chat") as any;
            const chat = chatData?.dataValues || chatData;
            if (!chat || chat.isGroup || chat.type === "support") return null;
            const other = (chat.participants || []).find((p: any) => p.userId !== userId);
            return other?.userId || null;
          })
          .filter(Boolean) as string[]
      )
    );

    const galleryUserIds = new Set<string>();
    if (dmPartnerIds.length > 0) {
      const [galleryOwners, hiddenProfiles] = await Promise.all([
        models.GalleryItem.findAll({
          where: { userId: { [Op.in]: dmPartnerIds } },
          attributes: ["userId"],
          group: ["userId"],
        }),
        // A gallery the person chose not to show on their profile stays private -
        // the ring must not give away that it exists.
        models.Profile.findAll({
          where: { userId: { [Op.in]: dmPartnerIds }, showGalleryOnWelcome: false },
          attributes: ["userId"],
        }),
      ]);

      const hiddenIds = new Set(hiddenProfiles.map((profile: any) => profile.userId));
      for (const owner of galleryOwners) {
        const ownerId = (owner as any).userId;
        if (ownerId && !hiddenIds.has(ownerId)) galleryUserIds.add(ownerId);
      }
    }

    // Format the response
    const formattedChats = finalChats.map(chatParticipant => {
      const chatData = chatParticipant.get("chat") as any;
      // Use plain() or toJSON() to get actual data values from Sequelize model
      const chat = chatData.dataValues || chatData;
      const participants = chat.participants || [];
      const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

      // For DMs, get the other participant
      let chatName = "Unknown";
      let chatAvatar = null;
      let isOnline = false;
      let memberCount = participants.length;
      let hasGallery = false;

      if (chat.type === 'support') {
        // Support chats always display as "Support" regardless of participants
        chatName = 'Support';
      } else if (!chat.isGroup) {
        const otherParticipant = participants.find((p: any) => p.userId !== userId);
        if (otherParticipant && otherParticipant.user) {
          const firstName = otherParticipant.user.firstName || '';
          const lastName = otherParticipant.user.lastName || '';
          chatName = `${firstName} ${lastName}`.trim() || 'Unknown User';
          chatAvatar = otherParticipant.user.profile?.profileImage;
          isOnline = otherParticipant.user.isOnline;
          hasGallery = galleryUserIds.has(otherParticipant.userId);
        }
      } else {
        // For groups, get group name from the associated group
        if (chat.group) {
          chatName = chat.group.name;
          chatAvatar = chat.group.profilePictureUrl;
          memberCount = chat.group.memberCount || participants.length;
        } else {
          chatName = `Group Chat (${memberCount} members)`;
        }
        isOnline = participants.filter((p: any) => p.user?.isOnline).length;
      }

      // Get unread count from the calculated map
      const unreadCount = unreadCountMap[chat.id] || 0;

      return {
        id: chat.id,
        name: chatName,
        isGroup: chat.isGroup,
        type: chat.type,
        securityMode: chat.securityMode || "legacy",
        protocolVersion: chat.protocolVersion || null,
        groupId: chat.groupId, // Include groupId for group chats
        avatar: chatAvatar,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          messageType: lastMessage.messageType,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender ?
            `${lastMessage.sender.firstName || ''} ${lastMessage.sender.lastName || ''}`.trim() || "Unknown" :
            "Unknown"
        } : null,
        unreadCount,
        isOnline,
        // Drives the gold ring on the avatar: this person has photos worth opening
        hasGallery,
        memberCount: chat.isGroup ? memberCount : undefined,
        participants: participants.map((p: any) => ({
          userId: p.userId,
          user: p.user
        }))
      };
    });

    const preferredDirectChats = new Map<string, (typeof formattedChats)[number]>();

    for (const chat of formattedChats) {
      if (chat.isGroup || chat.type === "support") {
        continue;
      }

      const otherParticipant = chat.participants.find((participant: any) => participant.userId !== userId);
      if (!otherParticipant) {
        continue;
      }

      const mapKey = `dm:${otherParticipant.userId}`;
      const existing = preferredDirectChats.get(mapKey);

      if (!existing) {
        preferredDirectChats.set(mapKey, chat);
        continue;
      }

      const existingIsSecure = existing.securityMode === "secure_dm_v1";
      const currentIsSecure = chat.securityMode === "secure_dm_v1";

      if (currentIsSecure && !existingIsSecure) {
        preferredDirectChats.set(mapKey, chat);
        continue;
      }

      if (currentIsSecure === existingIsSecure) {
        const existingTimestamp = new Date(existing.lastMessage?.createdAt || 0).getTime();
        const currentTimestamp = new Date(chat.lastMessage?.createdAt || 0).getTime();

        if (currentTimestamp > existingTimestamp) {
          preferredDirectChats.set(mapKey, chat);
        }
      }
    }

    const dedupedFormattedChats = formattedChats.filter((chat) => {
      if (chat.isGroup || chat.type === "support") {
        return true;
      }

      const otherParticipant = chat.participants.find((participant: any) => participant.userId !== userId);
      if (!otherParticipant) {
        return true;
      }

      const preferredChat = preferredDirectChats.get(`dm:${otherParticipant.userId}`);
      return preferredChat?.id === chat.id;
    });

    res.json({
      success: true,
      data: dedupedFormattedChats
    });

  } catch (error) {
    console.error("Error fetching user chats:", error);
    next(error);
  }
};

// Get decrypted chat messages
export const getChatMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Get decrypted messages using ChatService
    const result = await chatService.getDecryptedMessages(
      chatId,
      userId,
      Number(page),
      Number(limit),
      models
    );

    // Get read receipts for display
    const readReceipts = await models.ChatParticipant.findAll({
      where: {
        chatId,
        lastReadAt: {
          [Op.not]: null as any
        }
      },
      attributes: ["userId", "lastReadAt"],
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["firstName", "lastName"]
        }
      ]
    });

    const messagesInOrder = result.rows.reverse();
    const replyTargetIds = messagesInOrder.reduce((acc: string[], message: any) => {
      const id = message.replyToMessageId as string | undefined;
      if (id && !acc.includes(id)) {
        acc.push(id);
      }
      return acc;
    }, []);

    const replyTargets = replyTargetIds.length > 0
      ? await models.ChatMessage.findAll({
          where: { id: { [Op.in]: replyTargetIds } },
          include: [{
            model: models.User,
            as: "sender",
            attributes: ["id", "firstName", "lastName"]
          }]
        })
      : [];

    const replyTargetMap = new Map(
      replyTargets.map((msg: any) => [msg.id, msg])
    );

    // Fetch all reactions for this page of messages in one query
    const messageIds = messagesInOrder.map((m: any) => m.id);
    const allReactionRows = messageIds.length > 0
      ? await models.MessageReaction.findAll({
          where: { messageId: { [Op.in]: messageIds } },
          attributes: ["messageId", "userId", "emoji"],
        })
      : [];

    // Group raw reaction rows by messageId
    const reactionsMap = new Map<string, Array<{ userId: string; emoji: string }>>();
    for (const row of allReactionRows) {
      const r = row as any;
      const existing = reactionsMap.get(r.messageId) ?? [];
      existing.push({ userId: r.userId, emoji: r.emoji });
      reactionsMap.set(r.messageId, existing);
    }

    const formattedMessages = messagesInOrder.map((message: any) => ({
      id: message.id,
      chatId: message.chatId,
      content: message.content, // Already decrypted by service
      messageType: message.messageType,
      replyToMessageId: message.replyToMessageId,
      status: message.status,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      createdAt: message.createdAt,
      // Media fields
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      fileSize: message.fileSize,
      thumbnailUrl: message.thumbnailUrl,
      fileName: message.fileName,
      mimeType: message.mimeType,
      duration: message.duration,
      mentions: message.mentions,
      reactions: reactionsMap.get(message.id) ?? [],
      replyTo: message.replyToMessageId
        ? (() => {
            const target = replyTargetMap.get(message.replyToMessageId);
            if (!target) return null;
            const senderName = target.sender
              ? `${target.sender.firstName || ""} ${target.sender.lastName || ""}`.trim() || "Unknown"
              : "Unknown";
            return {
              id: target.id,
              content: target.content,
              messageType: target.messageType,
              senderName,
            };
          })()
        : null,
      sender: {
        id: message.senderId,
        name: message.sender ?
          `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || "Unknown" :
          "Unknown",
        avatar: message.sender?.profile?.profileImage
      },
      readBy: readReceipts
        .filter(receipt => new Date(receipt.lastReadAt!) >= new Date(message.createdAt))
        .map(receipt => ({
          userId: receipt.userId,
          name: receipt.get("user") ?
            `${(receipt.get("user") as any).firstName || ''} ${(receipt.get("user") as any).lastName || ''}`.trim() || "Unknown" :
            "Unknown",
          readAt: receipt.lastReadAt
        }))
    }));

    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.count,
          totalPages: Math.ceil(result.count / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch messages"
    });
  }
};

// Create or get DM chat
export const createOrGetDMChat = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { participantId } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    if (!participantId) {
      res.status(400).json({
        success: false,
        message: "Participant ID is required"
      });
      return;
    }

    if (participantId === userId) {
      res.status(400).json({
        success: false,
        message: "Cannot create chat with yourself"
      });
      return;
    }

    // Check if DM chat already exists between these users
    // First get all chats that both users participate in
    const userChats = await models.ChatParticipant.findAll({
      where: { userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { isGroup: false }
        }
      ]
    });

    const participantChats = await models.ChatParticipant.findAll({
      where: { userId: participantId },
      include: [
        {
          model: models.Chat,
          as: "chat",
          where: { isGroup: false }
        }
      ]
    });

    // Find common chat IDs
    const userChatIds = userChats.map(cp => cp.chatId);
    const participantChatIds = participantChats.map(cp => cp.chatId);
    const commonChatIds = userChatIds.filter(id => participantChatIds.includes(id));

    let existingSecureChat = null;
    let existingLegacyChat = null;
    if (commonChatIds.length > 0) {
      // Verify it's exactly a 2-person chat
      for (const chatId of commonChatIds) {
        const participantCount = await models.ChatParticipant.count({
          where: { chatId }
        });

        if (participantCount === 2) {
          const candidateChat = await models.Chat.findByPk(chatId);
          if (candidateChat?.securityMode === "secure_dm_v1") {
            existingSecureChat = candidateChat;
            break;
          }
          if (!existingLegacyChat) {
            existingLegacyChat = candidateChat;
          }
        }
      }
    }

    const resolvedChat = existingSecureChat || existingLegacyChat;
    if (resolvedChat) {
      res.json({
        success: true,
        data: {
          chatId: resolvedChat.id,
          securityMode: resolvedChat.securityMode || "legacy",
          protocolVersion: resolvedChat.protocolVersion || null,
        },
        message: "Existing chat found"
      });
      return;
    }

    // Verify the other user exists and they are contacts
    const otherUser = await models.User.findByPk(participantId);
    if (!otherUser) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    // Check if users are contacts
    const contactRelation = await models.Contact.findOne({
      where: {
        [Op.or]: [
          { userAId: userId, userBId: participantId },
          { userAId: participantId, userBId: userId }
        ],
        status: "active"
      }
    });

    if (!contactRelation) {
      res.status(403).json({
        success: false,
        message: "You can only start chats with your contacts"
      });
      return;
    }

    const shouldCreateSecureChat = await supportsSecureDmBetweenUsers(models, [
      userId,
      participantId,
    ]);

    // Create new DM chat
    const transaction = await sequelizeConnection.transaction();

    try {
      const newChat = await models.Chat.create(
        {
          isGroup: false,
          securityMode: shouldCreateSecureChat ? "secure_dm_v1" : "legacy",
          protocolVersion: shouldCreateSecureChat ? SECURE_DM_PROTOCOL_VERSION : null,
        },
        { transaction }
      );

      // Add both participants
      await models.ChatParticipant.bulkCreate([
        {
          chatId: newChat.id,
          userId: userId,
          joinedAt: new Date()
        },
        {
          chatId: newChat.id,
          userId: participantId,
          joinedAt: new Date()
        }
      ], { transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: {
          chatId: newChat.id,
          securityMode: newChat.securityMode,
          protocolVersion: newChat.protocolVersion,
        },
        message: "Chat created successfully"
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error("Error creating DM chat:", error);
    next(error);
  }
};

// Send encrypted message
export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { content, messageType = "text", transactionId, replyToMessageId } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Verify user is participant in the chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId }
    });

    if (!participant) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to send messages to this chat"
      });
      return;
    }

    // Get Socket.IO instance for real-time updates
    const io = req.app.get("io");

    // Send encrypted message using ChatService
    const message = await chatService.sendMessage(
      userId,
      chatId,
      content,
      messageType,
      models,
      io,
      req.app, // Pass Express app for notifications
      replyToMessageId
    );

    // Send push notifications to other participants
    const otherParticipants = await models.ChatParticipant.findAll({
      where: {
        chatId,
        userId: { [Op.ne]: userId }
      },
      include: [{
        model: models.User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    const sender = await models.User.findByPk(userId, {
      attributes: ['firstName', 'lastName']
    });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';



    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        chatId,
        content, // Return original content for sender
        messageType,
        replyToMessageId: message.replyToMessageId,
        status: message.status,
        createdAt: message.createdAt,
        sender: message.get("sender")
      }
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send message"
    });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Get Socket.IO instance
    const io = req.app.get("io");

    // Mark messages as read using ChatService
    await chatService.markMessagesAsRead(chatId, userId, models, io);

    res.json({
      success: true,
      message: "Messages marked as read"
    });

  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to mark messages as read"
    });
  }
};

// Configure multer for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

// Send media message (images, videos, audio, documents)
export const sendMediaMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { caption } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Verify user is participant in the chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId }
    });

    if (!participant) {
      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.status(403).json({
        success: false,
        message: "You are not authorized to send messages to this chat"
      });
      return;
    }

    // Get Socket.IO instance for real-time updates
    const io = req.app.get("io");

    // Send media message using ChatService
    const message = await chatService.sendMediaMessage(
      userId,
      chatId,
      file,
      caption || '',
      models,
      io,
      req.app // Pass Express app for notifications
    );

    // Clean up temporary file after upload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

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
        sender: message.get("sender")
      }
    });

  } catch (error) {
    console.error("Error sending media message:", error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send media message"
    });
  }
};

// Get online status of chat participants
export const getChatParticipantsStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Verify user is participant in the chat
    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId }
    });

    if (!participant) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to view this chat"
      });
      return;
    }

    const participants = await models.ChatParticipant.findAll({
      where: { chatId },
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "isOnline", "lastSeen"]
        }
      ]
    });

    const participantsStatus = participants.map(p => ({
      userId: p.userId,
      name: p.get("user") ?
        `${(p.get("user") as any).firstName} ${(p.get("user") as any).lastName}` :
        "Unknown",
      isOnline: (p.get("user") as any)?.isOnline || false,
      lastSeen: (p.get("user") as any)?.lastSeen
    }));

    res.json({
      success: true,
      data: participantsStatus
    });

  } catch (error) {
    console.error("Error fetching participants status:", error);
    next(error);
  }
};

// Create group chat
export const createGroupChat = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { participantIds, groupName } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      res.status(400).json({
        success: false,
        message: "At least 2 participants are required for a group chat"
      });
      return;
    }

    // Include the creator in participants
    const allParticipants = Array.from(new Set([userId, ...participantIds]));

    // Initialize encryption keys for creator if not exists
    await chatService.initializeUserKeys(userId, "default_password", models);

    // Create group chat with encryption
    const chat = await chatService.createOrGetChat(allParticipants, true, models);

    res.status(201).json({
      success: true,
      data: {
        chatId: chat.id,
        isGroup: true,
        participants: allParticipants,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating group chat:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create group chat"
    });
  }
};

// Delete chat
/**
 * Who may pin in this conversation. A DM is between equals, so either person can
 * pin; a group's pinned bar is shared furniture, so it belongs to its admins.
 */
const canPinInChat = async (
  models: ReturnType<typeof Models>,
  chat: any,
  userId: string
): Promise<boolean> => {
  if (!chat?.isGroup) return true;
  if (!chat.groupId) return false;
  const membership = await models.GroupMember.findOne({
    where: {
      groupId: chat.groupId,
      userId,
      role: { [Op.in]: ["owner", "admin"] },
      status: "active",
    },
  });
  return Boolean(membership);
};

const loadPinnableMessage = async (
  models: ReturnType<typeof Models>,
  chatId: string,
  messageId: string,
  userId: string
) => {
  const participant = await models.ChatParticipant.findOne({
    where: { chatId, userId },
  });
  if (!participant) {
    throw Object.assign(new Error("You are not a participant in this chat"), {
      statusCode: 403,
    });
  }

  const message = await models.ChatMessage.findOne({ where: { id: messageId, chatId } });
  if (!message) {
    throw Object.assign(new Error("Message not found"), { statusCode: 404 });
  }

  const chat = await models.Chat.findByPk(chatId, {
    attributes: ["id", "isGroup", "groupId"],
  });
  if (!(await canPinInChat(models, chat, userId))) {
    throw Object.assign(new Error("Only group admins can pin in this chat"), {
      statusCode: 403,
    });
  }

  return message;
};

const emitPinEvent = async (
  req: AuthenticatedRequest,
  event: "message_pinned" | "message_unpinned",
  payload: Record<string, any>
) => {
  const models = req.app.get("models") as ReturnType<typeof Models>;
  const io = req.app.get("io");
  if (!io) return;
  const participants = await models.ChatParticipant.findAll({
    where: { chatId: payload.chatId },
    attributes: ["userId"],
  });
  for (const participant of participants) {
    io.to(`user_${(participant as any).userId}`).emit(event, payload);
  }
};

/** Pin anything in the conversation - a message, a card, a photo. */
export const pinMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId, messageId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const message = await loadPinnableMessage(models, chatId, messageId, userId);
    if ((message as any).deletedAt) {
      res.status(409).json({ success: false, message: "This message was deleted" });
      return;
    }

    const pinnedAt = (message as any).pinnedAt || new Date();
    if (!(message as any).pinnedAt) {
      await models.ChatMessage.update(
        { pinnedAt, pinnedBy: userId } as any,
        { where: { id: messageId } }
      );
    }

    const pinnedByUser = await models.User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });
    const payload = {
      chatId,
      messageId,
      pinnedAt,
      pinnedBy: userId,
      pinnedByName:
        `${(pinnedByUser as any)?.firstName || ""} ${(pinnedByUser as any)?.lastName || ""}`.trim() ||
        "Someone",
    };

    await emitPinEvent(req, "message_pinned", payload);
    res.status(200).json({ success: true, message: "Message pinned", data: payload });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const unpinMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId, messageId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    await loadPinnableMessage(models, chatId, messageId, userId);
    await models.ChatMessage.update(
      { pinnedAt: null, pinnedBy: null } as any,
      { where: { id: messageId } }
    );

    const payload = { chatId, messageId };
    await emitPinEvent(req, "message_unpinned", payload);
    res.status(200).json({ success: true, message: "Message unpinned", data: payload });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

/**
 * The pins in a conversation, newest first.
 *
 * Encrypted text never leaves as ciphertext: a secure message reports only who sent
 * it and when, and the client renders the preview from its own decrypted copy.
 */
export const getPinnedMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const participant = await models.ChatParticipant.findOne({
      where: { chatId, userId },
    });
    if (!participant) {
      res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
      return;
    }

    const pinned = await models.ChatMessage.findAll({
      where: { chatId, pinnedAt: { [Op.ne]: null }, deletedAt: null },
      include: [
        {
          model: models.User,
          as: "sender",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["pinnedAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: pinned.map((message: any) => ({
        messageId: message.id,
        chatId: message.chatId,
        messageType: message.messageType,
        // Ciphertext stays on the server; the client already holds the plaintext
        content: message.isEncrypted ? null : message.content,
        isEncrypted: message.isEncrypted,
        createdAt: message.createdAt,
        pinnedAt: message.pinnedAt,
        pinnedBy: message.pinnedBy,
        senderId: message.senderId,
        senderName: message.sender
          ? `${message.sender.firstName || ""} ${message.sender.lastName || ""}`.trim() ||
            "Unknown"
          : "Unknown",
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Edit the text of a message you sent.
 *
 * Plain conversations only: in a secure chat the text lives as per-device ciphertext,
 * so an edit has to be re-encrypted by the sending device and goes through
 * PATCH /e2ee/chats/:chatId/messages/:messageId instead.
 */
export const editMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const trimmed = String(content ?? "").trim();
    if (!trimmed) {
      res.status(400).json({ success: false, message: "A message cannot be empty" });
      return;
    }

    const chat = await models.Chat.findByPk(chatId, {
      attributes: ["id", "securityMode"],
    });
    if ((chat as any)?.securityMode === "secure_dm_v1") {
      res.status(400).json({
        success: false,
        message: "Secure messages must be edited through the secure endpoint",
      });
      return;
    }

    const message = await models.ChatMessage.findOne({
      where: { id: messageId, chatId },
    });
    if (!message) {
      res.status(404).json({ success: false, message: "Message not found" });
      return;
    }
    if ((message as any).senderId !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only edit messages you sent",
      });
      return;
    }
    if ((message as any).deletedAt) {
      res.status(409).json({ success: false, message: "This message was deleted" });
      return;
    }
    if ((message as any).messageType !== "text") {
      res.status(400).json({
        success: false,
        message: "Only text messages can be edited",
      });
      return;
    }

    const editedAt = new Date();
    await models.ChatMessage.update(
      { content: trimmed, editedAt } as any,
      { where: { id: messageId } }
    );

    const io = req.app.get("io");
    if (io) {
      const participants = await models.ChatParticipant.findAll({
        where: { chatId },
        attributes: ["userId"],
      });
      for (const participant of participants) {
        io.to(`user_${(participant as any).userId}`).emit("message_edited", {
          chatId,
          messageId,
          content: trimmed,
          editedAt,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Message updated",
      data: { chatId, messageId, content: trimmed, editedAt },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a message you sent, for everyone.
 *
 * The row stays as a tombstone so the conversation keeps its shape and both sides
 * see the same thing - but everything that carried the content goes: the text, the
 * media fields, the mentions, and (for secure chats) the per-device ciphertext
 * envelopes, which would otherwise still hold the readable message.
 */
export const deleteMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId, messageId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const message = await models.ChatMessage.findOne({
      where: { id: messageId, chatId },
    });
    if (!message) {
      res.status(404).json({ success: false, message: "Message not found" });
      return;
    }
    if ((message as any).senderId !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only delete messages you sent",
      });
      return;
    }

    // Deleting twice is not an error - report the existing tombstone
    const [ownedNote, ownedPoll] = await Promise.all([
      models.SharedNote.findOne({ where: { messageId } }),
      models.Poll.findOne({ where: { messageId } }),
    ]);

    if (!(message as any).deletedAt) {
      const deletedAt = new Date();

      await sequelizeConnection.transaction(async (transaction) => {
        await models.ChatMessage.update(
          {
            content: "",
            mediaUrl: null,
            mediaType: null,
            thumbnailUrl: null,
            fileName: null,
            mimeType: null,
            fileSize: null,
            duration: null,
            mentions: null,
            deletedAt,
            deletedBy: userId,
          } as any,
          { where: { id: messageId }, transaction }
        );

        // Secure chats keep the ciphertext per recipient device - drop those too,
        // otherwise the message is still readable by anyone holding a key.
        await models.ChatMessageRecipientPayload.destroy({
          where: { chatMessageId: messageId },
          transaction,
        });

        // Some cards own a resource that outlives the message: a shared note stays
        // in the pinned bar, a poll stays live with nothing left linking to it.
        // Deleting the card takes its resource with it rather than orphaning it.
        if (ownedNote) {
          await models.SharedNote.destroy({
            where: { id: (ownedNote as any).id },
            transaction,
          });
        }
        if (ownedPoll) {
          await models.PollVote.destroy({
            where: { pollId: (ownedPoll as any).id },
            transaction,
          });
          await models.Poll.destroy({
            where: { id: (ownedPoll as any).id },
            transaction,
          });
        }
      });

      (message as any).deletedAt = deletedAt;
    }

    const io = req.app.get("io");
    if (io) {
      const participants = await models.ChatParticipant.findAll({
        where: { chatId },
        attributes: ["userId"],
      });
      for (const participant of participants) {
        const room = `user_${(participant as any).userId}`;
        io.to(room).emit("message_deleted", {
          chatId,
          messageId,
          deletedAt: (message as any).deletedAt,
          deletedBy: userId,
        });
        // Pinned bars, note panels and open editors need to let go of the resource
        if (ownedNote) {
          io.to(room).emit("shared_note_deleted", {
            chatId,
            noteId: (ownedNote as any).id,
          });
        }
        if (ownedPoll) {
          io.to(room).emit("poll_deleted", { chatId, pollId: (ownedPoll as any).id });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Message deleted",
      data: {
        chatId,
        messageId,
        deletedAt: (message as any).deletedAt,
        deletedBy: userId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteChat = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Get Socket.IO instance
    const io = req.app.get("io");

    // Delete chat using ChatService
    await chatService.deleteChat(chatId, userId, models, io);

    res.json({
      success: true,
      message: "Chat deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete chat"
    });
  }
};

// Initialize user encryption keys
export const initializeUserEncryption = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { password = "default_password" } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    // Initialize encryption keys for user
    const userKeys = await chatService.initializeUserKeys(userId, password, models);

    res.json({
      success: true,
      data: {
        userId: userKeys.userId,
        publicKey: userKeys.publicKey,
        initialized: true
      }
    });

  } catch (error) {
    console.error("Error initializing user encryption:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initialize encryption"
    });
  }
};

// Join or create a group's chat
export const joinGroupChat = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: 'active' // Only active members can join chat
      }
    });

    if (!groupMember) {
      res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
      return;
    }

    // Check if group exists
    const group = await models.Group.findByPk(groupId);
    if (!group) {
      res.status(404).json({
        success: false,
        message: "Group not found"
      });
      return;
    }

    // Check if a chat already exists for this group
    let chat = await models.Chat.findOne({
      where: { groupId, isGroup: true }
    });

    // If no chat exists, create one
    if (!chat) {
      const transaction = await sequelizeConnection.transaction();

      try {
        // Create the chat
        chat = await models.Chat.create({
          isGroup: true,
          groupId,
          securityMode: "legacy",
          protocolVersion: null,
        }, { transaction });

        // Get all active group members
        const groupMembers = await models.GroupMember.findAll({
          where: { groupId, status: 'active' }
        });

        // Add all group members as chat participants
        const participantData = groupMembers.map(member => ({
          chatId: chat!.id,
          userId: member.userId,
          joinedAt: new Date()
        }));

        await models.ChatParticipant.bulkCreate(participantData, { transaction });

        // Create dummy chat keys for all participants (encryption temporarily disabled)
        const chatKeyData = groupMembers.map(member => ({
          chatId: chat!.id,
          userId: member.userId,
          encryptedKey: 'dummy_key_' + member.userId, // Temporary dummy key
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await models.ChatKey.bulkCreate(chatKeyData, { transaction });

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      // Check if user is already a participant
      const existingParticipant = await models.ChatParticipant.findOne({
        where: { chatId: chat.id, userId }
      });

      // If not a participant, add them
      if (!existingParticipant) {
        await models.ChatParticipant.create({
          chatId: chat.id,
          userId,
          joinedAt: new Date()
        });

        // Create dummy chat key for new participant (encryption temporarily disabled)
        const existingChatKey = await models.ChatKey.findOne({
          where: { chatId: chat.id, userId }
        });

        if (!existingChatKey) {
          await models.ChatKey.create({
            chatId: chat.id,
            userId,
            encryptedKey: 'dummy_key_' + userId // Temporary dummy key
          });
        }
      }
    }

    // Return the chat with group info
    const chatWithGroup = await models.Chat.findByPk(chat.id, {
      include: [
        {
          model: models.Group,
          as: 'group',
          attributes: ['id', 'name', 'description', 'profilePictureUrl', 'memberCount']
        },
        {
          model: models.ChatParticipant,
          as: 'participants',
          include: [
            {
              model: models.User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName', 'email', 'isOnline']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: {
        chatId: chat.id,
        groupId: group.id,
        groupName: group.name,
        chat: chatWithGroup
      }
    });

  } catch (error) {
    console.error("Error joining group chat:", error);
    next(error);
  }
};
