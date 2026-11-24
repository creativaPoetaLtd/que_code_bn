import cron from "node-cron";
import { Application } from "express";
import { expireStaleTopUps } from "../services/topUp.service";

/**
 * Fails top-ups the provider never answered. Needed for real providers (missed callbacks)
 * and for the simulator, whose in-memory timers are lost when the server restarts.
 */
export const initTopUpJobs = (app: Application): void => {
  cron.schedule("*/5 * * * *", () => {
    expireStaleTopUps(app).catch((error) => {
      console.error("[topups] Expiry poll failed:", error);
    });
  });

  console.log("✅ Top-up jobs initialized (expiry: every 5 minutes)");
};
