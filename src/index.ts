// index.ts - Server entry point (auto-reload test - email fix)
import app from "./app";
import {
  connectionToDatabase,
  sequelizeConnection,
} from "./database/config/db.config";
import * as http from "http";
import { Server as SocketIOServer } from "socket.io";
// Remove PORT import since we define it locally as SERVER_PORT
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

    // 6. Set up Socket.IO with enhanced chat functionality
    const socketAllowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      process.env.FRONTEND_URL,
      process.env.ADMIN_FRONTEND_URL,
      "https://qiew-code-dev2.netlify.app",
      "https://qc-dev2.netlify.app",
    ].filter(Boolean) as string[];

    const io = new SocketIOServer(server, {
      cors: {
        origin: socketAllowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket", "polling"]
    });
    app.set("io", io);

    // Initialize Socket Manager for enhanced chat functionality
    const SocketManager = await import("./socket/socketManager");
    const socketManager = new SocketManager.default(io, app);
    app.set("socketManager", socketManager);

    const SERVER_PORT = process.env.PORT || 5500;
    server.listen(SERVER_PORT, () => {
      console.log(`🚀 Server is running on port ${SERVER_PORT}`);
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
