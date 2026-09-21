/**
 * Shared helpers for money-movement flows that aren't themselves chat-initiated
 * (batch transfers, scheduled transfers) but still need to post/update a chat message
 * so the recipient sees it the same way a normal chat send already works
 * (chatMoneyController.sendMoneyInChat, escrowController's hold messages).
 *
 * Best-effort by design: callers should catch and log failures here rather than let
 * them block the actual money movement, which has already happened by the time these
 * run.
 */

const broadcastToChatParticipants = async (io: any, models: any, chatId: string, event: string, payload: any) => {
  if (!io) return;
  const participants = await models.ChatParticipant.findAll({ where: { chatId }, attributes: ["userId"] });
  for (const p of participants) {
    io.to(`user_${p.userId}`).emit(event, payload);
  }
};

/**
 * Posts a new `messageType: "money"` chat message with the given content and broadcasts
 * it. `content` should already be a plain object (e.g. `{ type: "money_transfer", ... }`
 * or `{ type: "scheduled_transfer", ... }`) - this function just persists and fans it out.
 */
export const postMoneyChatMessage = async (
  io: any,
  models: any,
  chatId: string,
  senderId: string,
  content: Record<string, any>
): Promise<any> => {
  const message = await models.ChatMessage.create({
    chatId,
    senderId,
    content: JSON.stringify(content),
    messageType: "money",
    isEncrypted: false,
    encryptionIv: "",
    status: "sent",
  });

  const messageWithSender = await models.ChatMessage.findByPk(message.id, {
    include: [{ model: models.User, as: "sender", attributes: ["id", "firstName", "lastName"] }],
  });

  await broadcastToChatParticipants(io, models, chatId, "new_message", messageWithSender.toJSON());

  return messageWithSender;
};

/**
 * Patches an already-posted scheduled_transfer message's content in place (e.g.
 * "scheduled" -> "completed"/"failed"/"cancelled") and tells connected clients via the
 * same live-update pattern already used for money requests (payment_request_updated).
 */
export const updateScheduledTransferMessage = async (
  io: any,
  models: any,
  chatMessageId: string,
  updates: { status: string; transactionId?: string | null }
): Promise<void> => {
  const message = await models.ChatMessage.findByPk(chatMessageId);
  if (!message) return;

  let parsed: any;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    return;
  }
  if (parsed?.type !== "scheduled_transfer") return;

  const updatedContent = { ...parsed, status: updates.status, transactionId: updates.transactionId ?? parsed.transactionId };
  await message.update({ content: JSON.stringify(updatedContent) });

  await broadcastToChatParticipants(io, models, message.chatId, "scheduled_transfer_updated", {
    scheduledTransferId: parsed.scheduledTransferId,
    status: updates.status,
    transactionId: updates.transactionId ?? parsed.transactionId ?? null,
    chatId: message.chatId,
  });
};
