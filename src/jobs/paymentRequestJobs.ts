import cron from "node-cron";
import { expireStalePaymentRequests, PAYMENT_REQUEST_TTL_DAYS } from "../utils/paymentRequests";

const runExpiry = async (): Promise<void> => {
  try {
    const expired = await expireStalePaymentRequests();
    if (expired > 0) console.log(`[payment-requests] Expired ${expired} request(s) older than ${PAYMENT_REQUEST_TTL_DAYS} days`);
  } catch (error) {
    console.error("[payment-requests] Expiry run failed:", error);
  }
};

/**
 * Expires pending payment requests older than PAYMENT_REQUEST_TTL_DAYS. A single UPDATE, so
 * running it on several instances at once is harmless. Payment paths also refuse an expired
 * request on their own, so the hourly cadence never lets one be paid late.
 */
export const initPaymentRequestJobs = (): void => {
  void runExpiry();
  cron.schedule("15 * * * *", () => {
    void runExpiry();
  });

  console.log("✅ Payment request jobs initialized (expiry: hourly)");
};
