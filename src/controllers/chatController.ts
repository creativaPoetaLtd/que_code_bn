import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import { Op } from "sequelize";
import { sequelizeConnection } from "../database/config/db.config";
import ChatService from "../services/chatService";
import multer from "multer";
import path from "path";
import fs from "fs";

// Get user's chats (both DMs and group chats)
export const getUserChats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const chats = await models.ChatParticipant.findAll({
      where: { userId },
      include: [
        {
          model: models.Chat,
          as: "chat",
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
      ]
    });

    // Sort chats by latest message timestamp
    const sortedChats = chats.sort((a, b) => {
      const aChat = a.get("chat") as any;
      const bChat = b.get("chat") as any;
      
      const aLatestMessage = aChat.messages && aChat.messages.length > 0 ? aChat.messages[0] : null;
      const bLatestMessage = bChat.messages && bChat.messages.length > 0 ? bChat.messages[0] : null;
      
      if (!aLatestMessage && !bLatestMessage) return 0;
      if (!aLatestMessage) return 1;
      if (!bLatestMessage) return -1;
      
      return new Date(bLatestMessage.createdAt).getTime() - new Date(aLatestMessage.createdAt).getTime();
    });

    // Format the response
    const formattedChats = sortedChats.map(chatParticipant => {
      const chat = chatParticipant.get("chat") as any;
      const participants = chat.participants || [];
      const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

      // For DMs, get the other participant
      let chatName = "Unknown";
      let chatAvatar = null;
      let isOnline = false;
      let memberCount = participants.length;

      if (!chat.isGroup) {
        const otherParticipant = participants.find((p: any) => p.userId !== userId);
        if (otherParticipant && otherParticipant.user) {
          const firstName = otherParticipant.user.firstName || '';
          const lastName = otherParticipant.user.lastName || '';
          chatName = `${firstName} ${lastName}`.trim() || 'Unknown User';
          chatAvatar = otherParticipant.user.profile?.profileImage;
          isOnline = otherParticipant.user.isOnline;
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

      // Count unread messages
      const unreadCount = 0; // We'll implement this based on lastReadAt

      return {
        id: chat.id,
        name: chatName,
        isGroup: chat.isGroup,
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
        memberCount: chat.isGroup ? memberCount : undefined,
        participants: participants.map((p: any) => ({
          userId: p.userId,
          user: p.user
        }))
      };
    });

    res.json({
      success: true,
      data: formattedChats
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

    const formattedMessages = result.rows.reverse().map((message: any) => ({
      id: message.id,
      content: message.content, // Already decrypted by service
      messageType: message.messageType,
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

    let existingChat = null;
    if (commonChatIds.length > 0) {
      // Verify it's exactly a 2-person chat
      for (const chatId of commonChatIds) {
        const participantCount = await models.ChatParticipant.count({
          where: { chatId }
        });
        
        if (participantCount === 2) {
          existingChat = await models.Chat.findByPk(chatId);
          break;
        }
      }
    }

    if (existingChat) {
      res.json({
        success: true,
        data: { chatId: existingChat.id },
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

    // Create new DM chat
    const transaction = await sequelizeConnection.transaction();
    
    try {
      const newChat = await models.Chat.create(
        {
          isGroup: false
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
        data: { chatId: newChat.id },
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
    const { content, messageType = "text", transactionId } = req.body;
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
      io
    );

    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        chatId,
        content, // Return original content for sender
        messageType,
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
      io
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
          groupId
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