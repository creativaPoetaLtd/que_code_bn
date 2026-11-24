import cron from "node-cron";
import { Application } from "express";
import { processDueSubscriptions } from "../services/accountSubscription.service";

/**
 * Renews paid account types whose period has ended, applies scheduled downgrades, and
 * drops accounts whose renewal stayed unpaid past the grace period. Hourly is enough:
 * a period that ends mid-hour keeps its tier for at most an hour longer.
 */
export const initSubscriptionJobs = (app: Application): void => {
  cron.schedule("0 * * * *", () => {
    processDueSubscriptions(app).catch((error) => {
      console.error("[plans] Subscription renewal poll failed:", error);
    });
  });

  console.log("✅ Subscription jobs initialized (plan renewals: hourly)");
};
