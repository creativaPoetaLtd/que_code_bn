import { Response, NextFunction, Request } from "express";
import { Op } from "sequelize";
import Models from "../database/models";
import { 
  SendMessageRequest, 
  EditMessageRequest, 
  GetMessagesQuery, 
  MarkAsReadRequest,
  GroupChatSettingsUpdateRequest,
  ChatMessage,
  GroupChat
} from "../types/chat";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification } from "../utils/notificationService";
import multer from "multer";

export const getGroupChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Find or create chat for the group
    let chat = await models.Chat.findOne({
      where: { groupId, isGroup: true },
      include: [
        {
          model: models.Group,
          as: 'group',
          include: [
            {
              model: models.User,
              as: 'owner',
              attributes: ['id', 'firstName', 'lastName', 'email'],
              include: [{
                model: models.Profile,
                as: 'profiles',
                attributes: ['profileImage']
              }]
            }
          ]
        },
        {
          model: models.ChatParticipant,
          as: 'participants',
          include: [{
            model: models.User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [{
              model: models.Profile,
              as: 'profiles',
              attributes: ['profileImage']
            }]
          }]
        }
      ]
    });

    if (!chat) {
      // Create chat for the group
      chat = await models.Chat.create({
        groupId,
        isGroup: true
      });

      // Add all group members as chat participants
      const groupMembers = await models.GroupMember.findAll({
        where: { groupId, status: "active" }
      });

      const participantPromises = groupMembers.map(member =>
        models.ChatParticipant.create({
          chatId: chat!.id,
          userId: member.userId,
          joinedAt: new Date()
        })
      );

      await Promise.all(participantPromises);

      // Reload chat with includes
      chat = await models.Chat.findByPk(chat.id, {
        include: [
          {
            model: models.Group,
            as: 'group',
            include: [
              {
                model: models.User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email'],
                include: [{
                  model: models.Profile,
                  as: 'profiles',
                  attributes: ['profileImage']
                }]
              }
            ]
          },
          {
            model: models.ChatParticipant,
            as: 'participants',
            include: [{
              model: models.User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName', 'email'],
              include: [{
                model: models.Profile,
                as: 'profiles',
                attributes: ['profileImage']
              }]
            }]
          }
        ]
      });
    }

    // Ensure chat exists before proceeding
    if (!chat) {
      res.status(500).json({ message: "Failed to create or find chat" });
      return;
    }

    // Get chat settings
    const chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    // Get unread message count for this user
    const unreadCount = await models.ChatMessage.count({
      where: {
        chatId: chat.id,
        senderId: { [Op.ne]: userId },
        createdAt: {
          [Op.gt]: groupMember.lastReadAt || new Date(0)
        }
      }
    });

    res.json({
      message: "Group chat retrieved successfully",
      data: {
        ...chat.toJSON(),
        unreadCount,
        settings: chatSettings || {}
      }
    });

  } catch (error) {
    console.error("Error getting group chat:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { content, messageType = "text", transactionId, metadata, replyToMessageId }: SendMessageRequest = req.body;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Validate input
    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: "Message content is required" });
      return;
    }

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Get chat settings
    const chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    // Check if only admins can post
    if (chatSettings?.onlyAdminsCanPost && !["owner", "admin"].includes(groupMember.role)) {
      res.status(403).json({ message: "Only admins can post messages in this group" });
      return;
    }

    // Check slow mode
    if (chatSettings?.slowMode && groupMember.role === "member") {
      const lastMessage = await models.ChatMessage.findOne({
        where: { senderId: userId },
        order: [['createdAt', 'DESC']]
      });

      if (lastMessage && lastMessage.createdAt) {
        const timeDiff = Date.now() - new Date(lastMessage.createdAt).getTime();
        if (timeDiff < chatSettings.slowMode * 1000) {
          res.status(429).json({ 
            message: `Please wait ${chatSettings.slowMode - Math.floor(timeDiff / 1000)} seconds before sending another message` 
          });
          return;
        }
      }
    }

    // Find or create chat for the group
    let chat = await models.Chat.findOne({
      where: { groupId, isGroup: true }
    });

    if (!chat) {
      chat = await models.Chat.create({
        groupId,
        isGroup: true
      });

      // Add all group members as chat participants
      const groupMembers = await models.GroupMember.findAll({
        where: { groupId, status: "active" }
      });

      const participantPromises = groupMembers.map(member =>
        models.ChatParticipant.create({
          chatId: chat!.id,
          userId: member.userId,
          joinedAt: new Date()
        })
      );

      await Promise.all(participantPromises);
    }

    // Create the message
    const message = await models.ChatMessage.create({
      chatId: chat!.id,
      senderId: userId,
      content: content.trim(),
      messageType,
      transactionId,
      metadata,
      replyToMessageId
    });

    // Get message with sender details
    const messageWithSender = await models.ChatMessage.findByPk(message.id, {
      include: [
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: models.Profile,
            as: 'profiles',
            attributes: ['profileImage']
          }]
        },
        {
          model: models.ChatMessage,
          as: 'replyToMessage',
          include: [{
            model: models.User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName']
          }]
        }
      ]
    });

    // Get group details
    const group = await models.Group.findByPk(groupId);

    // Send notifications to all group members except the sender
    const groupMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        userId: { [Op.ne]: userId },
        status: "active"
      }
    });

    const notificationPromises = groupMembers.map(member =>
      createAndSendNotification(req.app, {
        type: replyToMessageId ? NotificationType.MESSAGE_REPLY : NotificationType.NEW_MESSAGE,
        recipientId: member.userId,
        data: {
          groupId,
          groupName: group?.name,
          userId: req.user!.id,
          userName: `${req.user!.firstName} ${req.user!.lastName}`,
          message: replyToMessageId 
            ? `${req.user!.firstName} replied to a message in ${group?.name}`
            : `${req.user!.firstName} sent a message in ${group?.name}`,
          description: content.substring(0, 100)
        }
      })
    );

    await Promise.all(notificationPromises);

    res.status(201).json({
      message: "Message sent successfully",
      data: messageWithSender
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50, before, after }: GetMessagesQuery = req.query as any;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Find chat for the group
    const chat = await models.Chat.findOne({
      where: { groupId, isGroup: true }
    });

    if (!chat) {
      res.json({
        message: "No messages found",
        data: {
          messages: [],
          pagination: {
            page: parseInt(page.toString()),
            limit: parseInt(limit.toString()),
            total: 0,
            totalPages: 0
          }
        }
      });
      return;
    }

    // Build where clause for pagination
    let whereClause: any = {
      chatId: chat.id,
      deletedAt: null
    };

    if (before) {
      const beforeMessage = await models.ChatMessage.findByPk(before);
      if (beforeMessage) {
        whereClause.createdAt = { [Op.lt]: beforeMessage.createdAt };
      }
    }

    if (after) {
      const afterMessage = await models.ChatMessage.findByPk(after);
      if (afterMessage) {
        whereClause.createdAt = { [Op.gt]: afterMessage.createdAt };
      }
    }

    const offset = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

    // Get messages with pagination
    const { count, rows: messages } = await models.ChatMessage.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: models.Profile,
            as: 'profiles',
            attributes: ['profileImage']
          }]
        },
        {
          model: models.ChatMessage,
          as: 'replyToMessage',
          include: [{
            model: models.User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName']
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit.toString()),
      offset
    });

    const totalPages = Math.ceil(count / parseInt(limit.toString()));

    res.json({
      message: "Messages retrieved successfully",
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          total: count,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const editMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId, messageId } = req.params;
    const { content }: EditMessageRequest = req.body;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: "Message content is required" });
      return;
    }

    // Find the message
    const message = await models.ChatMessage.findOne({
      where: {
        id: messageId,
        senderId: userId // Only sender can edit their own message
      },
      include: [{
        model: models.Chat,
        as: 'chat',
        where: { groupId, isGroup: true }
      }]
    });

    if (!message) {
      res.status(404).json({ message: "Message not found or you don't have permission to edit it" });
      return;
    }

    // Update the message
    await message.update({
      content: content.trim(),
      isEdited: true,
      editedAt: new Date()
    });

    // Get updated message with sender details
    const updatedMessage = await models.ChatMessage.findByPk(message.id, {
      include: [
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: models.Profile,
            as: 'profiles',
            attributes: ['profileImage']
          }]
        },
        {
          model: models.ChatMessage,
          as: 'replyToMessage',
          include: [{
            model: models.User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName']
          }]
        }
      ]
    });

    // Send notification about message edit
    const group = await models.Group.findByPk(groupId);
    const groupMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        userId: { [Op.ne]: userId },
        status: "active"
      }
    });

    const notificationPromises = groupMembers.map(member =>
      createAndSendNotification(req.app, {
        type: NotificationType.MESSAGE_EDITED,
        recipientId: member.userId,
        data: {
          groupId,
          groupName: group?.name,
          userId: req.user!.id,
          userName: `${req.user!.firstName} ${req.user!.lastName}`,
          message: `${req.user!.firstName} edited a message in ${group?.name}`
        }
      })
    );

    await Promise.all(notificationPromises);

    res.json({
      message: "Message edited successfully",
      data: updatedMessage
    });

  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId, messageId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Get chat settings to check delete permissions
    const chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    // Find the message
    const message = await models.ChatMessage.findOne({
      where: { id: messageId },
      include: [{
        model: models.Chat,
        as: 'chat',
        where: { groupId, isGroup: true }
      }]
    });

    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    // Check delete permissions
    const canDelete = message.senderId === userId || // Own message
                     ["owner", "admin"].includes(groupMember.role) || // Admin/Owner
                     chatSettings?.canMembersDeleteMessages; // Setting allows

    if (!canDelete) {
      res.status(403).json({ message: "You don't have permission to delete this message" });
      return;
    }

    // Soft delete the message
    await message.update({
      deletedAt: new Date(),
      content: "This message was deleted"
    });

    // Send notification about message deletion
    const group = await models.Group.findByPk(groupId);
    const groupMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        userId: { [Op.ne]: userId },
        status: "active"
      }
    });

    const notificationPromises = groupMembers.map(member =>
      createAndSendNotification(req.app, {
        type: NotificationType.MESSAGE_DELETED,
        recipientId: member.userId,
        data: {
          groupId,
          groupName: group?.name,
          userId: req.user!.id,
          userName: `${req.user!.firstName} ${req.user!.lastName}`,
          message: `A message was deleted in ${group?.name}`
        }
      })
    );

    await Promise.all(notificationPromises);

    res.json({ message: "Message deleted successfully" });

  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { messageIds }: MarkAsReadRequest = req.body;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Update last read time for group member
    await groupMember.update({
      lastReadAt: new Date()
    });

    // If specific message IDs provided, mark them as read
    if (messageIds && messageIds.length > 0) {
      const messages = await models.ChatMessage.findAll({
        where: {
          id: { [Op.in]: messageIds }
        },
        include: [{
          model: models.Chat,
          as: 'chat',
          where: { groupId, isGroup: true }
        }]
      });

      // Update readBy array for each message
      const updatePromises = messages.map(async (message) => {
        let readBy = message.readBy || [];
        if (!readBy.find((r: any) => r.userId === userId)) {
          readBy.push({
            userId,
            readAt: new Date()
          });
          await message.update({ readBy });
        }
      });

      await Promise.all(updatePromises);
    }

    res.json({ message: "Messages marked as read successfully" });

  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateChatSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    const settings: GroupChatSettingsUpdateRequest = req.body;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is owner or admin of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active",
        role: { [Op.in]: ["owner", "admin"] }
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "Only group owners and admins can update chat settings" });
      return;
    }

    // Find or create chat settings
    let chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    if (!chatSettings) {
      // Create new settings with defaults for required fields
      chatSettings = await models.GroupChatSettings.create({
        groupId,
        canMembersInvite: settings.canMembersInvite ?? true,
        canMembersDeleteMessages: settings.canMembersDeleteMessages ?? false,
        onlyAdminsCanPost: settings.onlyAdminsCanPost ?? false,
        allowFileSharing: settings.allowFileSharing ?? true,
        allowMoneyTransfers: settings.allowMoneyTransfers ?? true,
        profanityFilter: settings.profanityFilter ?? false,
        linkPreview: settings.linkPreview ?? true,
        readReceipts: settings.readReceipts ?? true,
        typingIndicators: settings.typingIndicators ?? true,
        announcementMode: settings.announcementMode ?? false,
        messageRetentionDays: settings.messageRetentionDays,
        maxFileSize: settings.maxFileSize,
        allowedFileTypes: settings.allowedFileTypes,
        slowMode: settings.slowMode
      });
    } else {
      await chatSettings.update(settings);
    }

    // Send notification to all group members about settings update
    const group = await models.Group.findByPk(groupId);
    const groupMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        userId: { [Op.ne]: userId },
        status: "active"
      }
    });

    const notificationPromises = groupMembers.map(member =>
      createAndSendNotification(req.app, {
        type: NotificationType.GROUP_SETTINGS_UPDATED,
        recipientId: member.userId,
        data: {
          groupId,
          groupName: group?.name,
          userId: req.user!.id,
          userName: `${req.user!.firstName} ${req.user!.lastName}`,
          message: `Chat settings were updated in ${group?.name}`
        }
      })
    );

    await Promise.all(notificationPromises);

    res.json({
      message: "Chat settings updated successfully",
      data: chatSettings
    });

  } catch (error) {
    console.error("Error updating chat settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getChatSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Get chat settings
    let chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    if (!chatSettings) {
      // Create default settings
      chatSettings = await models.GroupChatSettings.create({
        groupId,
        canMembersInvite: true,
        canMembersDeleteMessages: false,
        onlyAdminsCanPost: false,
        allowFileSharing: true,
        allowMoneyTransfers: true,
        profanityFilter: false,
        linkPreview: true,
        readReceipts: true,
        typingIndicators: true,
        announcementMode: false
      });
    }

    res.json({
      message: "Chat settings retrieved successfully",
      data: chatSettings
    });

  } catch (error) {
    console.error("Error getting chat settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { groupId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    
    const userId = req.user.id;
    const models = req.app.get('models') as ReturnType<typeof Models>;

    // Check if user is a member of the group
    const groupMember = await models.GroupMember.findOne({
      where: {
        groupId,
        userId,
        status: "active"
      }
    });

    if (!groupMember) {
      res.status(403).json({ message: "You are not a member of this group" });
      return;
    }

    // Get chat settings to check file sharing permissions
    const chatSettings = await models.GroupChatSettings.findOne({
      where: { groupId }
    });

    if (chatSettings && !chatSettings.allowFileSharing) {
      res.status(403).json({ message: "File sharing is disabled in this group" });
      return;
    }

    // Configure multer for file upload
    const storage = multer.memoryStorage();
    const upload = multer({
      storage,
      limits: {
        fileSize: chatSettings?.maxFileSize || 10 * 1024 * 1024 // 10MB default
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = chatSettings?.allowedFileTypes || [
          'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'mp3'
        ];
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        
        if (fileExtension && allowedTypes.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new Error('File type not allowed'));
        }
      }
    });

    // Use multer upload middleware
    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        console.error("File upload error:", err);
        res.status(400).json({ message: "File upload failed" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Check file size against group settings
      if (chatSettings?.maxFileSize && req.file.size > chatSettings.maxFileSize) {
        res.status(400).json({ 
          message: `File size exceeds limit of ${chatSettings.maxFileSize / 1024 / 1024}MB` 
        });
        return;
      }

      // Check file type against group settings
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
      if (chatSettings?.allowedFileTypes && !chatSettings.allowedFileTypes.includes(fileExtension || '')) {
        res.status(400).json({ 
          message: `File type .${fileExtension} is not allowed in this group` 
        });
        return;
      }

      const fileData = {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: req.file.path || `/uploads/${req.file.filename}`
      };

      res.json({
        message: "File uploaded successfully",
        data: fileData
      });
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};