import Models from "../database/models";
import { listActiveMembers } from "./sharedWalletContext";

/**
 * Fans a shared-wallet event out to every active member's `user_${userId}` room - the
 * one room pattern demonstrably wired up end-to-end on both client and server (unlike
 * `group:${groupId}`, which nothing ever joins clients into). Payload always carries
 * both `sharedWalletId` and `groupId` (null when standalone) so existing group-chat
 * consumers (e.g. chat-header.tsx's balance badge) keep working unmodified.
 */
export const broadcastToSharedWalletMembers = async (
  io: any,
  models: ReturnType<typeof Models>,
  sharedWallet: { id: string; groupId?: string | null },
  event: string,
  payload: Record<string, any>
): Promise<void> => {
  if (!io) return;
  const members = await listActiveMembers(models, sharedWallet);
  const fullPayload = { sharedWalletId: sharedWallet.id, groupId: sharedWallet.groupId ?? null, ...payload };
  for (const member of members) {
    io.to(`user_${member.userId}`).emit(event, fullPayload);
  }
};
