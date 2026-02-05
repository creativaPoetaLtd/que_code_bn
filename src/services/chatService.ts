import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import { Op } from "sequelize";
import MessageEncryption from "./messageEncryption.service";
import bcrypt from "bcryptjs";
import { uploadChatMedia } from "./mediaUploadService";
import { Application } from "express";
import { notifyChatMessageReceived } from "../utils/notificationHelpers";

export class ChatService {
  private static instance: ChatService;
  private encryption: MessageEncryption;

  private constructor() {
    this.encryption = MessageEncryption.getInstance();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Initialize or get user encryption keys
  async initializeUserKeys(userId: string, password: string, models: any) {
    try {
      let userKeys = await models.UserKey.findOne({ where: { userId } });
      
      if (!userKeys) {
        try {
          // Generate new key pair for user
          const keyPair = this.encryption.generateUserKeyPair(userId);
          
          // Encrypt private key with user's password
          const saltRounds = 10;
          const encryptedPrivateKey = await bcrypt.hash(keyPair.privateKey, saltRounds);
          
          // Store in database
          userKeys = await models.UserKey.create({
            userId,
            publicKey: keyPair.publicKey,
            privateKeyEncrypted: encryptedPrivateKey
          });
        } catch (createError: any) {
          // If there's a unique constraint error, try to find the keys again
          // This handles race conditions where keys might have been created between our check and create
          if (createError.name === 'SequelizeUniqueConstraintError') {
            userKeys = await models.UserKey.findOne({ where: { userId } });
            if (!userKeys) {
              throw createError; // If still not found, re-throw the original error
            }
          } else {
            throw createError;
          }
        }
      }
      
      return userKeys;
    } catch (error) {
      console.error('Error initializing user keys:', error);
      throw error;
    }
  }

  // Create or get existing chat
  async createOrGetChat(participantIds: string[], isGroup: boolean = false, models: any) {
    try {
      if (!isGroup && participantIds.length === 2) {
        // For DMs, check if chat already exists between these two users
        const existingChat = await models.Chat.findOne({
          where: { isGroup: false },
          include: [{
            model: models.ChatParticipant,
            as: 'participants',
            where: {
              userId: { [Op.in]: participantIds }
            }
          }]
        });

        if (existingChat) {
          const participants = existingChat.get('participants') as any[];
          if (participants.length === 2) {
            return existingChat;
          }
        }
      }

      // Create new chat
      const chat = await models.Chat.create({
        isGroup,
        createdBy: participantIds[0]
      });

      // Add participants
      const participantPromises = participantIds.map(userId =>
        models.ChatParticipant.create({
          chatId: chat.id,
          userId,
          joinedAt: new Date()
        })
      );

      await Promise.all(participantPromises);

      // Generate and distribute chat encryption key
      await this.setupChatEncryption(chat.id, participantIds, models);

      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Setup encryption for a chat
  async setupChatEncryption(chatId: string, participantIds: string[], models: any) {
    try {
      // Generate symmetric key for this chat
      const chatKey = this.encryption.generateChatKey(chatId);

      // Encrypt chat key for each participant
      for (const userId of participantIds) {
        const userKeys = await models.UserKey.findOne({ where: { userId } });
        if (userKeys) {
          const encryptedChatKey = this.encryption.encryptKeyForUser(chatKey, userKeys.publicKey);
          
          await models.ChatKey.create({
            chatId,
            userId,
            encryptedKey: encryptedChatKey
          });
        }
      }
    } catch (error) {
      console.error('Error setting up chat encryption:', error);
      throw error;
    }
  }

  // Ensure chat key exists for a specific user in a chat
  async ensureChatKeyForUser(chatId: string, userId: string, models: any) {
    try {
      // Check if chat key already exists
      const existingKey = await models.ChatKey.findOne({
        where: { chatId, userId }
      });
      
      if (existingKey) {
        return; // Key already exists
      }

      // TEMPORARY: Create a dummy chat key record to avoid errors
      // Since encryption is disabled, we don't need real encrypted keys
      console.log('Creating dummy chat key for user (encryption disabled):', userId);
      
      await models.ChatKey.create({
        chatId,
        userId,
        encryptedKey: 'dummy_key_' + Date.now() // Placeholder key
      });
    } catch (error) {
      console.error('Error ensuring chat key for user:', error);
      // Don't throw error for now to keep messages working
      console.log('Continuing without chat key due to temporary encryption disable');
    }
  }

  // Send encrypted message
  async sendMessage(senderId: string, chatId: string, content: string, messageType: string, models: any, io?: any, app?: Application) {
    try {
      // Get chat key for encryption
      let chatKeyRecord = await models.ChatKey.findOne({
        where: { chatId, userId: senderId }
      });

      // If no chat key exists, create one for this user
      if (!chatKeyRecord) {
        await this.ensureChatKeyForUser(chatId, senderId, models);
        chatKeyRecord = await models.ChatKey.findOne({
          where: { chatId, userId: senderId }
        });
        
        if (!chatKeyRecord) {
          throw new Error('Chat key not found for user');
        }
      }

      // TEMPORARY FIX: Disable encryption for now to get messages working
      // The encryption system needs to be properly implemented with correct key management
      console.log('Encryption temporarily disabled - sending unencrypted message');
      
      // Store message without encryption for now
      const encryptedContent = content; // Store as plain text temporarily
      const iv = ''; // Empty IV for unencrypted content

      // Save message to database (temporarily unencrypted)
      const message = await models.ChatMessage.create({
        chatId,
        senderId,
        content: encryptedContent, // This is actually unencrypted content
        messageType,
        isEncrypted: false, // Temporarily disabled
        encryptionIv: iv,
        status: 'sent',
        createdAt: new Date()
      });

      // Get message with sender info for response
      const messageWithSender = await models.ChatMessage.findByPk(message.id, {
        include: [{
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: models.Profile,
            as: 'profile',
            attributes: ['profileImage']
          }]
        }]
      });

      // Get chat details to determine if it's a group chat
      const chat = await models.Chat.findByPk(chatId, {
        include: [{
          model: models.Group,
          as: 'group',
          attributes: ['name']
        }]
      });

      const isGroupChat = chat?.isGroup || false;
      const chatName = isGroupChat && chat?.get('group') 
        ? (chat.get('group') as any).name 
        : undefined;

      // Get sender details
      const sender = messageWithSender.get('sender') as any;
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      // Broadcast to chat participants via Socket.IO
      if (io) {
        const participants = await models.ChatParticipant.findAll({
          where: { chatId },
          attributes: ['userId'],
          include: [{
            model: models.User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName']
          }]
        });

        // TEMPORARY: Send unencrypted message to all participants
        for (const participant of participants) {
          io.to(`user:${participant.userId}`).emit('new_message', {
            ...messageWithSender.toJSON(),
            content: encryptedContent // This is actually unencrypted content now
          });

          // Send notification to other participants (not the sender)
          if (participant.userId !== senderId && app) {
            await notifyChatMessageReceived(
              app,
              participant.userId,
              chatId,
              message.id,
              senderId,
              senderName,
              content,
              messageType,
              isGroupChat,
              chatName
            );
          }
        }

        // Update message delivery status
        setTimeout(async () => {
          await models.ChatMessage.update(
            { status: 'delivered', deliveredAt: new Date() },
            { where: { id: message.id } }
          );
        }, 100);
      }

      return messageWithSender;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Send media message (images, videos, audio, documents)
  async sendMediaMessage(
    senderId: string,
    chatId: string,
    file: Express.Multer.File,
    caption: string = '',
    models: any,
    io?: any,
    app?: Application
  ) {
    try {
      // Upload media to Cloudinary
      const uploadResult = await uploadChatMedia(file);

      if (!uploadResult.success || !uploadResult.data) {
        throw new Error(uploadResult.error || 'Failed to upload media');
      }

      const {
        url,
        thumbnailUrl,
        mediaType,
        fileSize,
        fileName,
        mimeType,
        duration
      } = uploadResult.data;

      // Determine message type based on media type
      let messageType: string;
      switch (mediaType) {
        case 'image':
          messageType = 'image';
          break;
        case 'video':
          messageType = 'video';
          break;
        case 'audio':
          messageType = 'audio';
          break;
        case 'document':
          messageType = 'document';
          break;
        default:
          messageType = 'file';
      }

      // Get chat key for encryption (if needed)
      let chatKeyRecord = await models.ChatKey.findOne({
        where: { chatId, userId: senderId }
      });

      if (!chatKeyRecord) {
        await this.ensureChatKeyForUser(chatId, senderId, models);
      }

      // Save media message to database
      const message = await models.ChatMessage.create({
        chatId,
        senderId,
        content: caption || `Sent a ${mediaType}`,
        messageType,
        isEncrypted: false,
        encryptionIv: '',
        status: 'sent',
        mediaUrl: url,
        mediaType,
        fileSize,
        thumbnailUrl,
        fileName,
        mimeType,
        duration,
        createdAt: new Date()
      });

      // Get message with sender info for response
      const messageWithSender = await models.ChatMessage.findByPk(message.id, {
        include: [{
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: models.Profile,
            as: 'profile',
            attributes: ['profileImage']
          }]
        }]
      });

      // Get chat details to determine if it's a group chat
      const chat = await models.Chat.findByPk(chatId, {
        include: [{
          model: models.Group,
          as: 'group',
          attributes: ['name']
        }]
      });

      const isGroupChat = chat?.isGroup || false;
      const chatName = isGroupChat && chat?.get('group') 
        ? (chat.get('group') as any).name 
        : undefined;

      // Get sender details
      const sender = messageWithSender.get('sender') as any;
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      // Broadcast to chat participants via Socket.IO
      if (io) {
        const participants = await models.ChatParticipant.findAll({
          where: { chatId },
          attributes: ['userId']
        });

        const broadcastMessage = messageWithSender.toJSON();

        for (const participant of participants) {
          io.to(`user:${participant.userId}`).emit('new_message', broadcastMessage);

          // Send notification to other participants (not the sender)
          if (participant.userId !== senderId && app) {
            await notifyChatMessageReceived(
              app,
              participant.userId,
              chatId,
              message.id,
              senderId,
              senderName,
              caption || `Sent a ${mediaType}`,
              messageType,
              isGroupChat,
              chatName,
              url,
              thumbnailUrl
            );
          }
        }

        // Update message delivery status
        setTimeout(async () => {
          await models.ChatMessage.update(
            { status: 'delivered', deliveredAt: new Date() },
            { where: { id: message.id } }
          );
        }, 100);
      }

      return messageWithSender;
    } catch (error) {
      console.error('Error sending media message:', error);
      throw error;
    }
  }

  // Get decrypted messages for user
  async getDecryptedMessages(chatId: string, userId: string, page: number = 1, limit: number = 50, models: any) {
    try {
      // Verify user is participant
      const participant = await models.ChatParticipant.findOne({
        where: { chatId, userId }
      });

      if (!participant) {
        throw new Error('User is not a participant in this chat');
      }

      // Get user's chat key (optional for backward compatibility with unencrypted chats)
      const chatKeyRecord = await models.ChatKey.findOne({
        where: { chatId, userId }
      });

      let chatKey = null;
      if (chatKeyRecord) {
        // Handle dummy keys for temporarily disabled encryption
        if (chatKeyRecord.encryptedKey.startsWith('dummy_key_')) {
          console.log('Using dummy key - encryption disabled');
          chatKey = 'dummy_chat_key'; // Dummy key for unencrypted messages
        } else {
          chatKey = this.encryption.decryptKeyForUserById(chatKeyRecord.encryptedKey, userId);
          if (!chatKey) {
            console.warn('Unable to decrypt chat key, treating messages as unencrypted');
          }
        }
      } else {
        console.log('No chat key found - treating messages as unencrypted');
      }

      // Get messages
      const offset = (page - 1) * limit;
      const messages = await models.ChatMessage.findAndCountAll({
        where: { chatId },
        include: [{
          model: models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: models.Profile,
            as: 'profile',
            attributes: ['profileImage']
          }]
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      // Decrypt messages
      const decryptedMessages = messages.rows.map((message: any) => {
        let decryptedContent = message.content;
        
        if (message.isEncrypted && message.encryptionIv && chatKey) {
          const decrypted = this.encryption.decryptMessage(
            message.content,
            message.encryptionIv,
            chatKey
          );
          if (decrypted) {
            decryptedContent = decrypted;
          }
        }
        // If no chatKey or not encrypted, use content as-is (unencrypted)

        return {
          ...message.toJSON(),
          content: decryptedContent
        };
      });

      return {
        rows: decryptedMessages,
        count: messages.count
      };
    } catch (error) {
      console.error('Error getting decrypted messages:', error);
      throw error;
    }
  }

  // Delete chat and cleanup encryption keys
  async deleteChat(chatId: string, userId: string, models: any, io?: any) {
    try {
      // Verify user has permission to delete (is participant or group admin)
      const participant = await models.ChatParticipant.findOne({
        where: { chatId, userId }
      });

      if (!participant) {
        throw new Error('User is not authorized to delete this chat');
      }

      const chat = await models.Chat.findByPk(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Get all participants for notification
      const participants = await models.ChatParticipant.findAll({
        where: { chatId },
        attributes: ['userId']
      });

      // Delete in transaction
      const transaction = await models.sequelize.transaction();
      
      try {
        // Delete messages
        await models.ChatMessage.destroy({
          where: { chatId },
          transaction
        });

        // Delete chat keys
        await models.ChatKey.destroy({
          where: { chatId },
          transaction
        });

        // Delete participants
        await models.ChatParticipant.destroy({
          where: { chatId },
          transaction
        });

        // Delete chat
        await models.Chat.destroy({
          where: { id: chatId },
          transaction
        });

        await transaction.commit();

        // Clear encryption keys from memory
        this.encryption.clearChatKey(chatId);

        // Notify participants via Socket.IO
        if (io) {
          participants.forEach((participant: any) => {
            io.to(`user:${participant.userId}`).emit('chat_deleted', {
              chatId,
              deletedBy: userId
            });
          });
        }

        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId: string, userId: string, models: any, io?: any) {
    try {
      const now = new Date();
      
      // Update participant's last read timestamp
      await models.ChatParticipant.update(
        { lastReadAt: now },
        { where: { chatId, userId } }
      );

      // Update unread messages status
      await models.ChatMessage.update(
        { status: 'read', readAt: now },
        { 
          where: { 
            chatId,
            status: { [Op.in]: ['sent', 'delivered'] },
            senderId: { [Op.ne]: userId }
          }
        }
      );

      // Notify other participants
      if (io) {
        const participants = await models.ChatParticipant.findAll({
          where: { 
            chatId,
            userId: { [Op.ne]: userId }
          },
          attributes: ['userId']
        });

        participants.forEach((participant: any) => {
          io.to(`user:${participant.userId}`).emit('messages_read', {
            chatId,
            readBy: userId,
            readAt: now
          });
        });
      }

      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }
}

export default ChatService;