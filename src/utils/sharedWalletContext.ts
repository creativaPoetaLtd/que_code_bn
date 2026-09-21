import { Op } from "sequelize";
import Models from "../database/models";

/**
 * Thrown by the resolvers below - the shared wallet controller maps `status`/`message`
 * onto its HTTP response the same way escrowController's ControllerError is handled.
 */
export class SharedWalletError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface NormalizedMember {
  userId: string;
  role: "owner" | "admin" | "member";
  status: string;
}

/**
 * A shared wallet either belongs to a Group (membership/quorum comes from the existing
 * GroupMember table, unchanged) or is standalone (membership comes from
 * SharedWalletMember). This module is the single place that branch lives - controllers
 * and services should always go through these helpers rather than checking
 * `sharedWallet.groupId` themselves.
 */

export const resolveSharedWallet = async (
  models: ReturnType<typeof Models>,
  sharedWalletId: string
) => {
  const sharedWallet = await models.SharedWallet.findByPk(sharedWalletId, {
    include: [
      { model: models.Group, as: "group", include: [{ model: models.Wallet, as: "wallet" }] },
      { model: models.Wallet, as: "wallet" },
    ],
  });
  if (!sharedWallet) throw new SharedWalletError(404, "Shared wallet not found");

  const group = (sharedWallet as any).group;
  // Group-attached: the pooled wallet is the group's existing Wallet (Wallet.groupId),
  // same as before this feature existed - unchanged so fundraising+shared-wallet groups
  // keep sharing one physical pool. Standalone: the wallet's own Wallet.sharedWalletId row.
  const wallet = group ? group.wallet : (sharedWallet as any).wallet;

  if (!wallet) throw new SharedWalletError(404, "Wallet not found for this shared wallet");
  if (!wallet.isActive) throw new SharedWalletError(400, "Shared wallet is inactive");

  return { sharedWallet, group: group || null, wallet };
};

/** Group-attached -> GroupMember; standalone -> SharedWalletMember. Normalizes both shapes. */
export const resolveMembership = async (
  models: ReturnType<typeof Models>,
  sharedWallet: { id: string; groupId?: string | null },
  userId: string
): Promise<NormalizedMember> => {
  if (sharedWallet.groupId) {
    const membership = await models.GroupMember.findOne({
      where: { groupId: sharedWallet.groupId, userId, status: "active" },
    });
    if (!membership) throw new SharedWalletError(403, "You are not an active member of this shared wallet");
    return { userId, role: membership.role, status: membership.status };
  }

  const membership = await models.SharedWalletMember.findOne({
    where: { sharedWalletId: sharedWallet.id, userId, status: "active" },
  });
  if (!membership) throw new SharedWalletError(403, "You are not an active member of this shared wallet");
  return { userId, role: membership.role, status: membership.status };
};

export const countOtherActiveMembers = async (
  models: ReturnType<typeof Models>,
  sharedWallet: { id: string; groupId?: string | null },
  excludeUserId: string
): Promise<number> => {
  if (sharedWallet.groupId) {
    return models.GroupMember.count({
      where: { groupId: sharedWallet.groupId, status: "active", userId: { [Op.ne]: excludeUserId } },
    });
  }
  return models.SharedWalletMember.count({
    where: { sharedWalletId: sharedWallet.id, status: "active", userId: { [Op.ne]: excludeUserId } },
  });
};

/** Full active-member list, normalized - used for the Members tab and realtime fan-out. */
export const listActiveMembers = async (
  models: ReturnType<typeof Models>,
  sharedWallet: { id: string; groupId?: string | null }
): Promise<NormalizedMember[]> => {
  if (sharedWallet.groupId) {
    const members = await models.GroupMember.findAll({
      where: { groupId: sharedWallet.groupId, status: "active" },
    });
    return members.map((m) => ({ userId: m.userId, role: m.role, status: m.status }));
  }
  const members = await models.SharedWalletMember.findAll({
    where: { sharedWalletId: sharedWallet.id, status: "active" },
  });
  return members.map((m) => ({ userId: m.userId, role: m.role, status: m.status }));
};

/**
 * `Chat.groupId` is nullable (DM chats have it null too), so
 * `Chat.findOne({ where: { groupId } })` with a null groupId would match an arbitrary
 * DM. Guard against that explicitly rather than relying on callers to remember.
 */
export const getChatIdForSharedWallet = async (
  models: ReturnType<typeof Models>,
  sharedWallet: { groupId?: string | null }
): Promise<string | null> => {
  if (!sharedWallet.groupId) return null;
  const chat = await models.Chat.findOne({ where: { groupId: sharedWallet.groupId } });
  return chat ? chat.id : null;
};
