// index.ts - Server entry point (auto-reload test - email fix)
import app from "./app";
import {
  connectionToDatabase,
  sequelizeConnection,
} from "./database/config/db.config";
import * as http from "http";
import { Server as SocketIOServer } from "socket.io";
import { PORT } from "./utils/keys";
import Models from "./database/models";

const startServer = async () => {
  try {
    // 1. Connect to database
    await connectionToDatabase();
    console.log("✅ Database connection established");

    // 2. Initialize models
    const models = Models(sequelizeConnection);

    // 3. Set up model associations
    Object.keys(models).forEach((key) => {
      const model = models[key as keyof typeof models];
      if (model && typeof (model as any).associate === "function") {
        (model as any).associate(models);
      }
    });

    // 4. Attach models to app instance
    app.set("models", models);

    // 5. Create and start server
    const server = http.createServer(app);

    // 6. Set up Socket.IO
    const io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Adjust as needed
        methods: ["GET", "POST"],
      },
    });
    app.set("io", io);

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);
      // You can add authentication and room joining logic here
      // Client should emit 'join' with their userId after connecting
      socket.on("join", (userId: string) => {
        socket.join(userId);
        console.log(`Socket ${socket.id} joined room ${userId}`);
      });
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    const PORT = process.env.PORT || 5500;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    process.on("SIGINT", () => {
      server.close(() => {
        console.log("Server stopped");
        process.exit(0);
      });
    });

    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
