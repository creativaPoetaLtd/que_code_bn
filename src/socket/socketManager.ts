// Enhanced Socket.IO setup for real-time encrypted chat functionality
import { Server as SocketIOServer, Socket } from "socket.io";
import { Application } from "express";
import Models from "../database/models";
import { AuthenticatedUser } from "../types/model";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../utils/keys";
import { Op } from "sequelize";
import ChatService from "../services/chatService";
import { 
  notifyChatMessageReceived, 
  notifyChatGroupChatCreated, 
  notifyChatDeleted 
} from "../utils/notificationHelpers";

interface SocketWithAuth extends Socket {
  userId?: string;
  user?: AuthenticatedUser;
}

interface OnlineUser {
  userId: string;
  socketId: string;
  lastSeen: Date;
}

interface TypingUser {
  userId: string;
  username: string;
  chatId: string;
  timestamp: Date;
}

const ALL_MENTION_USER_ID = "__all__";
const ALL_MENTION_USERNAME = "all";

class SocketManager {
  private io: SocketIOServer;
  private app: Application;
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private typingUsers: Map<string, TypingUser> = new Map(); // key: `${chatId}_${userId}`
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: SocketIOServer, app: Application) {
    this.io = io;
    this.app = app;
    this.setupSocketAuthentication();
    this.setupSocketHandlers();
  }

  private setupSocketAuthentication() {
    this.io.use(async (socket: SocketWithAuth, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error("Authentication error"));
        }

        const cleanToken = token.replace('Bearer ', '');
        const decoded = jwt.verify(cleanToken, JWT_SECRET) as any;
        
        const models = this.app.get("models") as ReturnType<typeof Models>;
        
        const user = await models.User.findByPk(decoded.id);
        if (!user) {
          return next(new Error("User not found"));
        }

        socket.userId = user.id;
        socket.user = user.get({ plain: true });
        next();
      } catch (err) {
        console.error('Socket auth failed:', err instanceof Error ? err.message : 'Unknown error');
        next(new Error("Authentication error"));
      }
    });
  }

  private setupSocketHandlers() {
    this.io.on("connection", (socket: SocketWithAuth) => {
      console.log(`User ${socket.userId} connected with socket ${socket.id}`);
      this.handleUserConnection(socket);

      // Chat message handlers
      socket.on("send_message", (data) => this.handleSendMessage(socket, data));
      socket.on("join_chat", (data) => this.handleJoinChat(socket, data));
      socket.on("leave_chat", (data) => this.handleLeaveChat(socket, data));
      socket.on("typing_start", (data) => this.handleTypingStart(socket, data));
      socket.on("typing_stop", (data) => this.handleTypingStop(socket, data));
      socket.on("mark_message_read", (data) => this.handleMarkMessageRead(socket, data));

      // Reaction handlers
      socket.on("add_reaction", (data) => this.handleAddReaction(socket, data));
      socket.on("remove_reaction", (data) => this.handleRemoveReaction(socket, data));

      // User status handlers
      socket.on("get_online_users", () => this.handleGetOnlineUsers(socket));
      socket.on("get_chat_participants_status", (data) => this.handleGetChatParticipantsStatus(socket, data));

      // Chat management handlers
      socket.on("create_group_chat", (data) => this.handleCreateGroupChat(socket, data));
      socket.on("delete_chat", (data) => this.handleDeleteChat(socket, data));

      // Encryption handlers
      socket.on("initialize_encryption", (data) => this.handleInitializeEncryption(socket, data));
      
      socket.on("disconnect", () => this.handleUserDisconnection(socket));
    });
  }

  private async handleUserConnection(socket: SocketWithAuth) {
    if (!socket.userId) return;

    // Add user to online users
    this.onlineUsers.set(socket.userId, {
      userId: socket.userId,
      socketId: socket.id,
      lastSeen: new Date()
    });

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // Update online status in database
    await this.updateUserOnlineStatus(socket.userId, true);

    // Join user's active chats
    await this.joinUserChats(socket);

    // Broadcast user online status to contacts
    this.broadcastUserStatus(socket.userId, true);

    // Send online users list to the connected user
    socket.emit("online_users", Array.from(this.onlineUsers.values()));
  }

  private async handleUserDisconnection(socket: SocketWithAuth) {
    if (!socket.userId) return;

    console.log(`User ${socket.userId} disconnected`);

    // Remove from online users
    this.onlineUsers.delete(socket.userId);

    // Update online status in database
    await this.updateUserOnlineStatus(socket.userId, false);

    // Broadcast user offline status to contacts
    this.broadcastUserStatus(socket.userId, false);
  }

  private async handleJoinChat(socket: SocketWithAuth, data: { chatId: string }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      // Verify user is participant in the chat
      const participant = await models.ChatParticipant.findOne({
        where: { chatId: data.chatId, userId: socket.userId }
      });

      if (!participant) {
        socket.emit("error", { message: "You are not a participant in this chat" });
        return;
      }

      // Join the chat room
      socket.join(`chat_${data.chatId}`);
      
      // Update last read timestamp
      await models.ChatParticipant.update(
        { lastReadAt: new Date() },
        { where: { chatId: data.chatId, userId: socket.userId } }
      );

      socket.emit("joined_chat", { chatId: data.chatId });
    } catch (error) {
      console.error("Error joining chat:", error);
      socket.emit("error", { message: "Failed to join chat" });
    }
  }

  private async handleLeaveChat(socket: SocketWithAuth, data: { chatId: string }) {
    socket.leave(`chat_${data.chatId}`);
    socket.emit("left_chat", { chatId: data.chatId });
  }

  private async handleSendMessage(socket: SocketWithAuth, data: {
    chatId: string;
    content: string;
    messageType: "text" | "image" | "file" | "money";
    transactionId?: string;
    replyToMessageId?: string;
    mentions?: Array<{ userId: string; username: string }>;
  }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();

    try {
      // Verify user is participant in the chat
      const participant = await models.ChatParticipant.findOne({
        where: { chatId: data.chatId, userId: socket.userId }
      });

      if (!participant) {
        socket.emit("error", { message: "You are not a participant in this chat" });
        return;
      }

      const chat = await models.Chat.findByPk(data.chatId, {
        attributes: ["id", "isGroup", "securityMode"]
      });

      if (chat?.securityMode === "secure_dm_v1") {
        socket.emit("error", {
          message: "This conversation requires secure messaging. Use the secure message flow.",
        });
        return;
      }

      // Sanitize mentions: deduplicate, remove self-mentions, cap at 20
      const hasAllMentionInPayload = !!data.mentions?.some(
        (m) => m.username?.toLowerCase() === ALL_MENTION_USERNAME || m.userId === ALL_MENTION_USER_ID
      );
      const hasAllMentionInText = /(^|\s)@all\b/i.test(data.content || "");
      const hasAllMention = !!chat?.isGroup && (hasAllMentionInPayload || hasAllMentionInText);

      const safeMentions = data.mentions
        ? [...new Map(
            data.mentions
              .filter((m) => {
                if (!m.userId || !m.username) return false;
                if (m.userId === socket.userId) return false;
                if (m.userId === ALL_MENTION_USER_ID || m.username.toLowerCase() === ALL_MENTION_USERNAME) {
                  return false;
                }
                return true;
              })
              .map((m) => [m.userId, m])
          ).values()].slice(0, 20)
        : [];

      if (hasAllMention) {
        safeMentions.unshift({ userId: ALL_MENTION_USER_ID, username: ALL_MENTION_USERNAME });
      }

      // Send encrypted message using ChatService
      const message = await chatService.sendMessage(
        socket.userId,
        data.chatId,
        data.content,
        data.messageType,
        models,
        this.io,
        this.app,
        data.replyToMessageId
      );

      const repliedMessage = data.replyToMessageId
        ? await models.ChatMessage.findByPk(data.replyToMessageId, {
            include: [{
              model: models.User,
              as: "sender",
              attributes: ["id", "firstName", "lastName"]
            }]
          })
        : null;

      const repliedMessageData = repliedMessage ? (repliedMessage as any).get({ plain: true }) : null;

      // Persist mentions on the saved message
      if (safeMentions.length > 0) {
        await models.ChatMessage.update(
          { mentions: safeMentions },
          { where: { id: message.id } }
        );
      }

      // Get message with sender info
      const messageWithSender = await models.ChatMessage.findByPk(message.id, {
        include: [
          {
            model: models.User,
            as: "sender",
            attributes: ["id", "firstName", "lastName", "email"],
            include: [
              {
                model: models.Profile,
                as: "profile",
                attributes: ["profileImage"]
              }
            ]
          }
        ]
      });

      // Broadcast message (including mentions) to all chat participants
      this.io.to(`chat_${data.chatId}`).emit("new_message", {
        id:            message.id,
        chatId:        data.chatId,
        senderId:      socket.userId,
        content:       data.content,
        messageType:   data.messageType,
        transactionId: data.transactionId,
        replyToMessageId: data.replyToMessageId || null,
        reactions:     [],
        replyTo: repliedMessage
          ? {
              id: repliedMessageData.id,
              content: repliedMessageData.content,
              messageType: repliedMessageData.messageType,
              senderName: repliedMessageData.sender
                ? `${repliedMessageData.sender.firstName || ""} ${repliedMessageData.sender.lastName || ""}`.trim() || "Unknown"
                : "Unknown",
            }
          : null,
        mentions:      safeMentions,
        createdAt:     message.createdAt,
        sender:        messageWithSender?.get("sender"),
      });

      // Notify all group members for @all, otherwise notify only explicitly mentioned users.
      if (hasAllMention) {
        await this.notifyAllMentionedUsers(
          data.chatId,
          message.id,
          socket.userId,
          socket.user,
          models
        );
      } else if (safeMentions.length > 0) {
        await this.notifyMentionedUsers(
          data.chatId,
          message.id,
          socket.userId,
          socket.user,
          safeMentions,
          models
        );
      }

    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  private async notifyAllMentionedUsers(
    chatId: string,
    messageId: string,
    senderId: string,
    senderUser: AuthenticatedUser | undefined,
    models: ReturnType<typeof Models>
  ) {
    const senderName = senderUser
      ? `${senderUser.firstName || ""} ${senderUser.lastName || ""}`.trim() || "Someone"
      : "Someone";

    const participants = await models.ChatParticipant.findAll({
      where: { chatId },
      attributes: ["userId"],
    });

    for (const participant of participants) {
      const mentionedUserId = (participant as any).userId as string;
      if (!mentionedUserId || mentionedUserId === senderId) continue;

      try {
        await models.Notification.create({
          userId: mentionedUserId,
          type: "mention",
          data: { chatId, messageId, senderId, senderName, mentionedUsername: ALL_MENTION_USERNAME, isAll: true },
          isRead: false,
        });
      } catch {
        // Non-fatal: notification creation failure should not abort the message
      }

      this.io.to(`user_${mentionedUserId}`).emit("mention_notification", {
        chatId,
        messageId,
        senderId,
        senderName,
        mentionedUsername: ALL_MENTION_USERNAME,
        isAll: true,
      });
    }
  }

  private async notifyMentionedUsers(
    chatId: string,
    messageId: string,
    senderId: string,
    senderUser: AuthenticatedUser | undefined,
    mentions: Array<{ userId: string; username: string }>,
    models: ReturnType<typeof Models>
  ) {
    const senderName = senderUser
      ? `${senderUser.firstName || ""} ${senderUser.lastName || ""}`.trim() || "Someone"
      : "Someone";

    // Verify each mentioned user is actually a participant of this chat
    const participantIds = new Set(
      (
        await models.ChatParticipant.findAll({
          where:      { chatId },
          attributes: ["userId"],
        })
      ).map((p: any) => p.userId as string)
    );

    for (const mention of mentions) {
      if (!participantIds.has(mention.userId)) continue;

      // Persist an in-app notification
      try {
        await models.Notification.create({
          userId: mention.userId,
          type:   "mention",
          data:   { chatId, messageId, senderId, senderName },
          isRead: false,
        });
      } catch {
        // Non-fatal: notification creation failure should not abort the message
      }

      // Live notification to mentioned user's personal room
      this.io.to(`user_${mention.userId}`).emit("mention_notification", {
        chatId,
        messageId,
        senderId,
        senderName,
        mentionedUsername: mention.username,
      });
    }
  }

  private async handleTypingStart(socket: SocketWithAuth, data: { chatId: string }) {
    if (!socket.userId || !socket.user) return;

    const typingKey = `${data.chatId}_${socket.userId}`;
    const username = `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim() || 'Unknown';

    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(typingKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Add to typing users
    this.typingUsers.set(typingKey, {
      userId: socket.userId,
      username,
      chatId: data.chatId,
      timestamp: new Date()
    });

    // Broadcast typing status
    socket.to(`chat_${data.chatId}`).emit("user_typing", {
      userId: socket.userId,
      username,
      chatId: data.chatId,
      isTyping: true
    });

    // Auto-stop typing after 3 seconds
    const timeout = setTimeout(() => {
      this.handleTypingStop(socket, data);
    }, 3000);

    this.typingTimeouts.set(typingKey, timeout);
  }

  private async handleTypingStop(socket: SocketWithAuth, data: { chatId: string }) {
    if (!socket.userId || !socket.user) return;

    const typingKey = `${data.chatId}_${socket.userId}`;
    const username = `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim() || 'Unknown';

    // Remove from typing users
    this.typingUsers.delete(typingKey);

    // Clear timeout
    const timeout = this.typingTimeouts.get(typingKey);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(typingKey);
    }

    // Broadcast typing stopped
    socket.to(`chat_${data.chatId}`).emit("user_typing", {
      userId: socket.userId,
      username,
      chatId: data.chatId,
      isTyping: false
    });
  }

  private async handleMarkMessageRead(socket: SocketWithAuth, data: { chatId: string, messageId?: string }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();
    
    try {
      // Mark messages as read using ChatService
      await chatService.markMessagesAsRead(data.chatId, socket.userId, models, this.io);

      // Send confirmation to the user
      socket.emit("message_read_confirmation", {
        chatId: data.chatId,
        readAt: new Date()
      });

    } catch (error) {
      console.error("Error marking message as read:", error);
      socket.emit("error", { message: "Failed to mark messages as read" });
    }
  }

  private handleGetOnlineUsers(socket: SocketWithAuth) {
    socket.emit("online_users", Array.from(this.onlineUsers.values()));
  }

  private async joinUserChats(socket: SocketWithAuth) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      const userChats = await models.ChatParticipant.findAll({
        where: { userId: socket.userId },
        attributes: ["chatId"]
      });

      userChats.forEach(chat => {
        socket.join(`chat_${chat.chatId}`);
      });
    } catch (error) {
      console.error("Error joining user chats:", error);
    }
  }

  private async updateUserOnlineStatus(userId: string, isOnline: boolean) {
    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      // You might want to add an online status field to the User model
      // For now, we'll track this in memory and potentially add to database later
      console.log(`User ${userId} is now ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error("Error updating user online status:", error);
    }
  }

  private async broadcastUserStatus(userId: string, isOnline: boolean) {
    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      // Get user's contacts
      const userContacts = await models.Contact.findAll({
        where: {
          [Op.or]: [
            { userAId: userId },
            { userBId: userId }
          ],
          status: "active"
        }
      });

      // Broadcast status to all contacts
      userContacts.forEach(contact => {
        const contactUserId = contact.userAId === userId ? contact.userBId : contact.userAId;
        this.io.to(`user_${contactUserId}`).emit("user_status_changed", {
          userId,
          isOnline,
          lastSeen: new Date()
        });
      });
    } catch (error) {
      console.error("Error broadcasting user status:", error);
    }
  }

  private async notifyOfflineParticipants(chatId: string, senderId: string, messageContent: string) {
    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      // Get chat participants who are not online
      const participants = await models.ChatParticipant.findAll({
        where: { chatId },
        include: [
          {
            model: models.User,
            as: "user",
            attributes: ["id", "firstName", "lastName"]
          }
        ]
      });

      const sender = await models.User.findByPk(senderId, {
        attributes: ["firstName", "lastName"]
      });

      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Someone";

      participants.forEach(participant => {
        const participantId = participant.userId;
        
        // Skip the sender
        if (participantId === senderId) return;
        
        // Check if user is online
        if (!this.onlineUsers.has(participantId)) {
          // Send push notification (integrate with your notification service)
          this.sendPushNotification(participantId, {
            title: `New message from ${senderName}`,
            body: messageContent,
            data: { chatId, senderId }
          });
        }
      });
    } catch (error) {
      console.error("Error notifying offline participants:", error);
    }
  }

  private async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    data: any;
  }) {
    // Integrate with your existing notification service
    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      await models.Notification.create({
        userId,
        type: "chat_message",
        data: notification.data,
        isRead: false
      });

      // If user comes online later, they'll receive this notification
      this.io.to(`user_${userId}`).emit("notification", {
        type: "chat_message",
        title: notification.title,
        body: notification.body,
        data: notification.data
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }

  /** Aggregate raw MessageReaction rows into the compact payload sent to clients */
  private aggregateReactions(
    rows: Array<{ userId: string; emoji: string }>,
    currentUserId: string
  ) {
    const map = new Map<string, { count: number; userIds: string[] }>();
    for (const row of rows) {
      const entry = map.get(row.emoji) ?? { count: 0, userIds: [] };
      entry.count++;
      entry.userIds.push(row.userId);
      map.set(row.emoji, entry);
    }
    return Array.from(map.entries()).map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      userIds,
      hasReacted: userIds.includes(currentUserId),
    }));
  }

  private async handleAddReaction(
    socket: SocketWithAuth,
    data: { chatId: string; messageId: string; emoji: string }
  ) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;

    try {
      // Verify user is a participant in the chat
      const participant = await models.ChatParticipant.findOne({
        where: { chatId: data.chatId, userId: socket.userId },
      });
      if (!participant) {
        socket.emit("error", { message: "You are not a participant in this chat" });
        return;
      }

      // Verify the message belongs to this chat
      const message = await models.ChatMessage.findOne({
        where: { id: data.messageId, chatId: data.chatId },
      });
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      const chat = await models.Chat.findByPk(data.chatId);
      if (chat?.securityMode === "secure_dm_v1") {
        socket.emit("error", { message: "Plaintext reactions are disabled for secure chats" });
        return;
      }

      const emoji = (data.emoji || "").trim().slice(0, 16);
      if (!emoji) {
        socket.emit("error", { message: "Invalid emoji" });
        return;
      }

      // Upsert: one reaction per user per message (update emoji if they switch)
      await (models.MessageReaction as any).upsert({
        messageId: data.messageId,
        userId: socket.userId,
        emoji,
      });

      // Fetch all reactions for this message and broadcast the updated set
      const allReactions = await models.MessageReaction.findAll({
        where: { messageId: data.messageId },
        attributes: ["userId", "emoji"],
      });

      const reactionRows = allReactions.map((r: any) => ({
        userId: r.userId as string,
        emoji: r.emoji as string,
      }));

      // Broadcast to every participant currently in the chat room
      this.io.to(`chat_${data.chatId}`).emit("reaction_updated", {
        chatId: data.chatId,
        messageId: data.messageId,
        reactions: reactionRows,
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      socket.emit("error", { message: "Failed to add reaction" });
    }
  }

  private async handleRemoveReaction(
    socket: SocketWithAuth,
    data: { chatId: string; messageId: string }
  ) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;

    try {
      // Verify participant
      const participant = await models.ChatParticipant.findOne({
        where: { chatId: data.chatId, userId: socket.userId },
      });
      if (!participant) {
        socket.emit("error", { message: "You are not a participant in this chat" });
        return;
      }

      const chat = await models.Chat.findByPk(data.chatId);
      if (chat?.securityMode === "secure_dm_v1") {
        socket.emit("error", { message: "Plaintext reactions are disabled for secure chats" });
        return;
      }

      await models.MessageReaction.destroy({
        where: { messageId: data.messageId, userId: socket.userId },
      });

      const allReactions = await models.MessageReaction.findAll({
        where: { messageId: data.messageId },
        attributes: ["userId", "emoji"],
      });

      const reactionRows = allReactions.map((r: any) => ({
        userId: r.userId as string,
        emoji: r.emoji as string,
      }));

      this.io.to(`chat_${data.chatId}`).emit("reaction_updated", {
        chatId: data.chatId,
        messageId: data.messageId,
        reactions: reactionRows,
      });
    } catch (error) {
      console.error("Error removing reaction:", error);
      socket.emit("error", { message: "Failed to remove reaction" });
    }
  }

  private async handleGetChatParticipantsStatus(socket: SocketWithAuth, data: { chatId: string }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    
    try {
      // Verify user is participant in the chat
      const participant = await models.ChatParticipant.findOne({
        where: { chatId: data.chatId, userId: socket.userId }
      });

      if (!participant) {
        socket.emit("error", { message: "You are not authorized to view this chat" });
        return;
      }

      // Get participants with online status
      const participants = await models.ChatParticipant.findAll({
        where: { chatId: data.chatId },
        include: [
          {
            model: models.User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "isOnline", "lastSeen"]
          }
        ]
      });

      const participantsStatus = participants.map((p: any) => ({
        userId: p.userId,
        name: p.user ? 
          `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || "Unknown" : 
          "Unknown",
        isOnline: this.isUserOnline(p.userId),
        lastSeen: p.user?.lastSeen
      }));

      socket.emit("chat_participants_status", {
        chatId: data.chatId,
        participants: participantsStatus
      });

    } catch (error) {
      console.error("Error getting chat participants status:", error);
      socket.emit("error", { message: "Failed to get participants status" });
    }
  }

  private async handleCreateGroupChat(socket: SocketWithAuth, data: { 
    participantIds: string[];
    groupName?: string;
  }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();
    
    try {
      if (!data.participantIds || data.participantIds.length < 2) {
        socket.emit("error", { message: "At least 2 participants are required" });
        return;
      }

      // Include the creator in participants
      const allParticipants = Array.from(new Set([socket.userId, ...data.participantIds]));

      // Create group chat with encryption
      const chat = await chatService.createOrGetChat(allParticipants, true, models);

      // Join the creator to the chat room
      socket.join(`chat_${chat.id}`);

      // Notify all participants about the new group chat
      const sender = await models.User.findByPk(socket.userId, {
        attributes: ['firstName', 'lastName']
      });
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      allParticipants.forEach(participantId => {
        this.io.to(`user_${participantId}`).emit("new_group_chat", {
          chatId: chat.id,
          isGroup: true,
          participants: allParticipants,
          createdBy: socket.userId || '',
          createdAt: chat.createdAt
        });

        // Send notification to other participants (not the creator)
        if (participantId !== socket.userId && socket.userId) {
          notifyChatGroupChatCreated(
            this.app,
            participantId,
            chat.id,
            '', // groupId will be from the Group model if exists
            data.groupName || 'New Group Chat',
            socket.userId,
            senderName
          );
        }
      });

      socket.emit("group_chat_created", {
        chatId: chat.id,
        participants: allParticipants
      });

    } catch (error) {
      console.error("Error creating group chat:", error);
      socket.emit("error", { message: "Failed to create group chat" });
    }
  }

  private async handleDeleteChat(socket: SocketWithAuth, data: { chatId: string }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();
    
    try {
      // Delete chat using ChatService (includes encryption cleanup)
      await chatService.deleteChat(data.chatId, socket.userId, models, this.io);

      socket.emit("chat_deleted", { 
        chatId: data.chatId,
        deletedBy: socket.userId 
      });

    } catch (error) {
      console.error("Error deleting chat:", error);
      socket.emit("error", { message: "Failed to delete chat" });
    }
  }

  private async handleInitializeEncryption(socket: SocketWithAuth, data: { password?: string }) {
    if (!socket.userId) return;

    const models = this.app.get("models") as ReturnType<typeof Models>;
    const chatService = ChatService.getInstance();
    
    try {
      // Initialize encryption keys for user
      const userKeys = await chatService.initializeUserKeys(
        socket.userId, 
        data.password || "default_password", 
        models
      );

      socket.emit("encryption_initialized", {
        userId: userKeys.userId,
        publicKey: userKeys.publicKey,
        initialized: true
      });

    } catch (error) {
      console.error("Error initializing encryption:", error);
      socket.emit("error", { message: "Failed to initialize encryption" });
    }
  }

  // Public methods for external use
  public getUserSocket(userId: string): string | null {
    const user = this.onlineUsers.get(userId);
    return user ? user.socketId : null;
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  public getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  public sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  public sendToChat(chatId: string, event: string, data: any) {
    this.io.to(`chat_${chatId}`).emit(event, data);
  }
}

export default SocketManager;
