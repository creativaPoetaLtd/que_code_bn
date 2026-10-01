/**
 * Fans a bill event out to the organizer and every payer's `user_${userId}` room (the same
 * room pattern the notification and shared-wallet sockets use). The payload always carries
 * `billId`, so clients can filter to the bill they have open.
 */
export const broadcastToBillParticipants = (
  io: any,
  participantUserIds: string[],
  billId: string,
  event: string,
  payload: Record<string, any> = {}
): void => {
  if (!io) return;
  const fullPayload = { billId, ...payload };
  for (const userId of new Set(participantUserIds)) {
    io.to(`user_${userId}`).emit(event, fullPayload);
  }
};
