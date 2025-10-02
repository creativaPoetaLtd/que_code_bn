import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { insert_function, read_function } from "../utils/db_methods";
import {
  ChatMessageAttributes,
  ChatMessageCreationAttributes,
  UserModelAttributes,
  ChatAttributes,
  ChatParticipantAttributes,
} from "../types/model";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: UserModelAttributes;
}

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

export const setupSocketIO = (server: HttpServer): SocketIOServer => {
  // Define allowed origins
  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
  ];

  console.log(
    "🔌 Setting up Socket.IO with CORS for origins:",
    allowedOrigins.join(", ")
  );

  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type"],
    },
  });

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        console.error("❌ Socket connection attempt without token");
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const decoded: any = jwt.verify(token, JWT_SECRET);

      if (!decoded || !decoded.id) {
        console.error("❌ Invalid token payload:", decoded);
        return next(new Error("Invalid authentication token"));
      }

      console.log(`🔑 Socket auth token verified for user ID: ${decoded.id}`);

      // Get user details
      const user = await read_function<UserModelAttributes>("User", "findOne", {
        where: { id: decoded.id },
        attributes: ["id", "firstName", "lastName", "email", "isVerified"],
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      const plainUser = isSequelizeInstance(user)
        ? user.get({ plain: true })
        : user;

      if (!plainUser.isVerified) {
        return next(new Error("User not verified"));
      }

      // Attach user to socket
      socket.userId = plainUser.id;
      socket.user = plainUser;

      console.log(
        `🔐 User authenticated: ${plainUser.firstName} ${plainUser.lastName} (${plainUser.id})`
      );
      next();
    } catch (error: any) {
      console.error("❌ Socket authentication error:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  // Handle connections
  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    console.log(
      `👋 User connected: ${authSocket.user.firstName} ${authSocket.user.lastName} (${authSocket.userId})`
    );

    // Join user to their personal room
    authSocket.join(`user_${authSocket.userId}`);

    // Join user's chats
    joinUserChats(authSocket);

    // Handle joining a specific chat
    authSocket.on("join_chat", async (data: { chatId: string }) => {
      try {
        const { chatId } = data;
        console.log(`🔄 User ${authSocket.userId} joining chat: ${chatId}`);

        // Verify user is participant in this chat
        const participant = await read_function<ChatParticipantAttributes>(
          "ChatParticipant",
          "findOne",
          {
            where: { chatId, userId: authSocket.userId },
          }
        );

        if (!participant) {
          authSocket.emit("error", {
            message: "Not authorized to join this chat",
          });
          return;
        }

        authSocket.join(`chat_${chatId}`);
        console.log(`✅ User ${authSocket.userId} joined chat: ${chatId}`);

        authSocket.emit("joined_chat", { chatId });
      } catch (error: any) {
        console.error("❌ Join chat error:", error.message);
        authSocket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Handle leaving a chat
    authSocket.on("leave_chat", (data: { chatId: string }) => {
      const { chatId } = data;
      authSocket.leave(`chat_${chatId}`);
      console.log(`👋 User ${authSocket.userId} left chat: ${chatId}`);
    });

    // Handle sending messages
    authSocket.on(
      "send_message",
      async (data: {
        chatId: string;
        content: string;
        messageType?: "text" | "image" | "file" | "money";
      }) => {
        try {
          const { chatId, content, messageType = "text" } = data;

          console.log(
            `📤 User ${authSocket.userId} sending message to chat: ${chatId}`
          );

          if (!content.trim()) {
            authSocket.emit("error", {
              message: "Message content cannot be empty",
            });
            return;
          }

          // Verify user is participant in this chat
          const participants = await read_function<ChatParticipantAttributes[]>(
            "ChatParticipant",
            "findAll",
            {
              where: { chatId, userId: authSocket.userId },
            }
          );

          if (!participants || participants.length === 0) {
            authSocket.emit("error", {
              message: "Chat not found or unauthorized",
            });
            return;
          }

          // Create message
          const messageData: ChatMessageCreationAttributes = {
            chatId,
            senderId: authSocket.userId,
            content: content.trim(),
            messageType,
          };

          const newMessage = await insert_function<ChatMessageAttributes>(
            "ChatMessage",
            "create",
            messageData
          );

          // Get sender details for the message
          const sender = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            {
              where: { id: authSocket.userId },
              attributes: ["id", "firstName", "lastName"],
            }
          );

          const messageWithSender = {
            ...(isSequelizeInstance(newMessage)
              ? newMessage.get({ plain: true })
              : newMessage),
            sender: isSequelizeInstance(sender)
              ? sender.get({ plain: true })
              : sender,
          };

          // Update chat's updatedAt timestamp
          await insert_function<ChatAttributes>(
            "Chat",
            "update",
            { updatedAt: new Date() },
            { where: { id: chatId } }
          );

          // Emit to all participants in the chat
          console.log(
            `📤 Emitting new_message to chat_${chatId}:`,
            messageWithSender
          );
          console.log(
            `📤 Number of connected sockets in chat_${chatId}:`,
            io.sockets.adapter.rooms.get(`chat_${chatId}`)?.size || 0
          );
          io.to(`chat_${chatId}`).emit("new_message", messageWithSender);

          console.log(`✅ Message sent successfully to chat: ${chatId}`);
        } catch (error: any) {
          console.error("❌ Send message error:", error.message);
          authSocket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    // Handle typing indicators
    authSocket.on("typing_start", (data: { chatId: string }) => {
      const { chatId } = data;
      authSocket.to(`chat_${chatId}`).emit("user_typing", {
        userId: authSocket.userId,
        user: authSocket.user,
        chatId,
      });
    });

    authSocket.on("typing_stop", (data: { chatId: string }) => {
      const { chatId } = data;
      authSocket.to(`chat_${chatId}`).emit("user_stopped_typing", {
        userId: authSocket.userId,
        chatId,
      });
    });

    // Handle marking messages as read
    authSocket.on("mark_as_read", async (data: { chatId: string }) => {
      try {
        const { chatId } = data;

        await insert_function<ChatParticipantAttributes>(
          "ChatParticipant",
          "update",
          { lastReadAt: new Date() },
          { where: { chatId, userId: authSocket.userId } }
        );

        // Notify other participants
        authSocket.to(`chat_${chatId}`).emit("message_read", {
          userId: authSocket.userId,
          chatId,
          readAt: new Date(),
        });

        console.log(
          `📖 User ${authSocket.userId} marked chat ${chatId} as read`
        );
      } catch (error: any) {
        console.error("❌ Mark as read error:", error.message);
      }
    });

    // Handle user going online/offline
    authSocket.on("user_online", () => {
      authSocket.broadcast.emit("user_status_change", {
        userId: authSocket.userId,
        status: "online",
      });
    });

    // Handle disconnection
    authSocket.on("disconnect", (reason: string) => {
      console.log(`👋 User ${authSocket.userId} disconnected: ${reason}`);

      // Notify others that user is offline
      authSocket.broadcast.emit("user_status_change", {
        userId: authSocket.userId,
        status: "offline",
      });
    });

    // Handle errors
    authSocket.on("error", (error: Error) => {
      console.error(`❌ Socket error for user ${authSocket.userId}:`, error);
    });
  });

  console.log("🚀 Socket.IO server initialized");
  return io;
};

// Helper function to join user to all their chats
const joinUserChats = async (socket: AuthenticatedSocket) => {
  try {
    const userChats:any = await read_function<ChatParticipantAttributes[]>(
      "ChatParticipant",
      "findAll",
      {
        where: { userId: socket.userId },
      }
    );

    const plainChats = Array.isArray(userChats)
      ? userChats.map((participant) =>
          isSequelizeInstance(participant)
            ? participant.get({ plain: true })
            : participant
        )
      : [];

    plainChats.forEach((participant) => {
      socket.join(`chat_${participant.chatId}`);
    });

    console.log(`✅ User ${socket.userId} joined ${plainChats.length} chats`);
  } catch (error: any) {
    console.error("❌ Error joining user chats:", error.message);
  }
};
