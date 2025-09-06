// index.ts - Server entry point (auto-reload test - email fix)
import app from "./app";
import {
  connectionToDatabase,
  sequelizeConnection,
} from "./database/config/db.config";
import * as http from "http";
import { PORT } from "./utils/keys";
import Models from "./database/models";
import { setupSocketIO } from "./utils/socketIO";

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
    const io = setupSocketIO(server);
    app.set("io", io);

    // Store server reference for graceful shutdown
    let serverInstance = server.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `❌ Port ${PORT} is already in use. Attempting to retry...`
        );

        // Try to kill the port using child_process
        try {
          const { execSync } = require("child_process");
          console.log(`🔫 Attempting to forcefully free port ${PORT}...`);
          execSync(`node_modules/.bin/kill-port ${PORT}`);
          console.log(`✅ Port ${PORT} freed. Retrying server startup...`);

          // Small delay before retrying
          setTimeout(() => {
            serverInstance = server.listen(PORT, () => {
              console.log(`🚀 Server is running at http://localhost:${PORT}`);
            });
          }, 1000);
        } catch (killError) {
          console.error(`❌ Failed to free port ${PORT}:`, killError);
          process.exit(1);
        }
      } else {
        console.error("❌ Server error:", error);
        process.exit(1);
      }
    });

    // Handle graceful shutdown for nodemon restarts and process termination
    const gracefulShutdown = async () => {
      console.log("🛑 Shutting down server gracefully...");

      // Free up the port immediately using kill-port
      try {
        const { execSync } = require("child_process");
        execSync(`node_modules/.bin/kill-port ${PORT}`, { stdio: "ignore" });
      } catch (e) {
        // Ignore errors from kill-port
      }

      // Close server connections
      serverInstance.close(async () => {
        console.log("🔌 Server closed. Disconnecting from database...");
        try {
          await sequelizeConnection.close();
          console.log("📦 Database connection closed.");

          // Give a small delay to ensure all cleanup is done
          setTimeout(() => {
            process.exit(0);
          }, 100);
        } catch (err) {
          console.error("❌ Error closing database connection:", err);
          process.exit(1);
        }
      });

      // Force close if graceful shutdown takes too long
      setTimeout(() => {
        console.error("⏱️ Server shutdown timed out. Forcing exit.");
        process.exit(1);
      }, 3000);
    };

    // Listen for process signals
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);

    // Handle uncaught exceptions and unhandled rejections to ensure clean shutdown
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      gracefulShutdown();
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Promise Rejection:", reason);
      gracefulShutdown();
    });

    // Special signal for nodemon
    process.once("SIGUSR2", () => {
      console.log("🔄 Nodemon restart signal (SIGUSR2) received");
      gracefulShutdown();
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
