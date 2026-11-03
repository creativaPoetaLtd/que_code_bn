import { Op } from "sequelize";
import database_models from "../database/config/db.config";

/** A pending request this old can no longer be paid; the expiry job marks it "expired". */
export const PAYMENT_REQUEST_TTL_DAYS = 30;

/** The requester can nudge the payer at most this often. */
export const PAYMENT_REQUEST_REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const paymentRequestExpiryCutoff = (now = new Date()) =>
  new Date(now.getTime() - PAYMENT_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

/** True for a still-pending request that is past its expiry, even before the job has run. */
export const isPaymentRequestExpired = (request: { status: string; createdAt?: Date }) =>
  request.status === "pending" &&
  !!request.createdAt &&
  new Date(request.createdAt) < paymentRequestExpiryCutoff();

/**
 * Mirrors a request's new state onto its money-request card in a chat (if it was sent in
 * one), so the chat shows the same status after a reload. Best effort: a failure here never
 * fails the action.
 */
export const updateRequestChatCard = async (
  chatId: string | undefined | null,
  requestId: string,
  patch: Record<string, unknown>,
) => {
  try {
    // Acting from the Requests page there is no chatId; find the card by its request id.
    const messages = await (database_models.ChatMessage as any).findAll({
      where: chatId
        ? { chatId, messageType: "money" }
        : { messageType: "money", content: { [Op.like]: `%${requestId}%` } },
    });
    for (const message of messages) {
      try {
        const parsed = JSON.parse(message.content);
        if (parsed?.type === "money_request" && parsed?.requestId === requestId) {
          await message.update({ content: JSON.stringify({ ...parsed, ...patch }) });
          return;
        }
      } catch {
        // Not a JSON card.
      }
    }
  } catch (error) {
    console.error("Failed to update money-request chat card:", error);
  }
};

/** Marks every pending request past its expiry as expired. Returns how many changed. */
export const expireStalePaymentRequests = async (): Promise<number> => {
  const [count] = await (database_models.PaymentRequest as any).update(
    { status: "expired" },
    { where: { status: "pending", createdAt: { [Op.lt]: paymentRequestExpiryCutoff() } } },
  );
  return count;
};
