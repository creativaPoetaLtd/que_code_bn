import { Response } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import { verifyTransactionPin, PinVerificationError } from "../utils/verifyPin";
import {
  executeSharedWalletWithdrawal,
  depositIntoSharedWallet as depositIntoSharedWalletService,
} from "../services/sharedWalletService";
import { postMoneyChatMessage, updateSharedWalletWithdrawalMessage } from "../services/moneyChatMessageService";
import {
  SharedWalletError,
  resolveSharedWallet,
  resolveMembership,
  countOtherActiveMembers,
  listActiveMembers,
  getChatIdForSharedWallet,
} from "../utils/sharedWalletContext";
import { broadcastToSharedWalletMembers } from "../utils/sharedWalletBroadcast";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification } from "../utils/notificationService";

const getModels = (req: AuthenticatedRequest) => req.app.get("models") as ReturnType<typeof Models>;
const getIo = (req: AuthenticatedRequest) => req.app.get("io");

const handleControllerError = (res: Response, error: unknown, context: string): void => {
  if (error instanceof SharedWalletError || error instanceof PinVerificationError) {
    const body: Record<string, unknown> = { success: false, message: error.message };
    if (error instanceof PinVerificationError && error.requiresPinSetup) {
      body.requiresPinSetup = true;
    }
    res.status(error.status).json(body);
    return;
  }
  console.error(`${context} error:`, error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

/** Majority of the *other* active members (excluding the requester): floor(n/2) + 1. */
const computeRequiredApprovals = (otherActiveMemberCount: number): number =>
  Math.floor(otherActiveMemberCount / 2) + 1;

/**
 * POST /shared-wallets
 * Creates a STANDALONE shared wallet (no group). Group-attached shared wallets are
 * still created via `POST /groups` with `hasSharedWallet: true` - see groupController.
 */
export const createSharedWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const creatorId = req.user.id;
    const { name, withdrawalPolicy, memberIds, pin } = req.body;

    if (!name || String(name).trim().length < 2) {
      throw new SharedWalletError(400, "A wallet name is required");
    }
    if (withdrawalPolicy !== "free" && withdrawalPolicy !== "approval") {
      throw new SharedWalletError(400, "withdrawalPolicy must be 'free' or 'approval'");
    }
    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      throw new SharedWalletError(400, "A shared wallet needs at least one other member");
    }
    await verifyTransactionPin(creatorId, pin);

    // Only add members who are actually the creator's contacts - same trust model as
    // the existing "pick from contacts" creation flow.
    const contacts = await models.Contact.findAll({
      where: {
        [Op.or]: [
          { userAId: creatorId, status: "active" },
          { userBId: creatorId, status: "active" },
        ],
      },
    });
    const contactUserIds = new Set(
      contacts.map((c) => (c.userAId === creatorId ? c.userBId : c.userAId))
    );
    const validMemberIds = Array.from(new Set(memberIds as string[])).filter(
      (id) => id !== creatorId && contactUserIds.has(id)
    );
    if (validMemberIds.length < 1) {
      throw new SharedWalletError(400, "Select at least one member from your contacts");
    }

    let sharedWallet: any;
    const invitedMemberships: { memberId: string; membershipId: string }[] = [];
    await models.sequelize.transaction(async (t: DbTransaction) => {
      sharedWallet = await models.SharedWallet.create(
        { name: String(name).trim(), withdrawalPolicy, createdByUserId: creatorId, groupId: null } as any,
        { transaction: t }
      );
      await models.Wallet.create(
        { sharedWalletId: sharedWallet.id, balance: 0 } as any,
        { transaction: t }
      );
      await models.SharedWalletMember.create(
        { sharedWalletId: sharedWallet.id, userId: creatorId, role: "owner", status: "active" } as any,
        { transaction: t }
      );
      for (const memberId of validMemberIds) {
        const membership = await models.SharedWalletMember.create(
          { sharedWalletId: sharedWallet.id, userId: memberId, role: "member", status: "pending" } as any,
          { transaction: t }
        );
        invitedMemberships.push({ memberId, membershipId: membership.id });
      }
    });

    const creator = await models.User.findByPk(creatorId);
    await Promise.all(
      invitedMemberships.map(({ memberId, membershipId }) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_INVITATION,
          recipientId: memberId,
          data: {
            sharedWalletId: sharedWallet.id,
            sharedWalletName: sharedWallet.name,
            membershipId,
            userId: creatorId,
            userName: creator ? `${creator.firstName} ${creator.lastName}` : "Someone",
            message: `${creator ? `${creator.firstName} ${creator.lastName}` : "Someone"} invited you to join the shared wallet '${sharedWallet.name}'`,
          },
        })
      )
    );

    res.status(201).json({ success: true, message: "Shared wallet created", data: { id: sharedWallet.id } });
  } catch (error) {
    handleControllerError(res, error, "Create shared wallet");
  }
};

/**
 * GET /shared-wallets
 * Lists every shared wallet the user is an active member of - both standalone and
 * group-attached - for the Wallet page's "Shared wallets" section.
 */
export const listMySharedWallets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const [groupMemberships, standaloneMemberships] = await Promise.all([
      models.GroupMember.findAll({ where: { userId, status: "active" }, attributes: ["groupId"] }),
      models.SharedWalletMember.findAll({ where: { userId, status: "active" }, attributes: ["sharedWalletId"] }),
    ]);
    const groupIds = groupMemberships.map((m) => m.groupId);
    const standaloneIds = standaloneMemberships.map((m) => m.sharedWalletId);

    const whereOr: any[] = [];
    if (groupIds.length > 0) whereOr.push({ groupId: { [Op.in]: groupIds } });
    if (standaloneIds.length > 0) whereOr.push({ id: { [Op.in]: standaloneIds } });

    if (whereOr.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const sharedWallets = await models.SharedWallet.findAll({
      where: { [Op.or]: whereOr },
      include: [
        { model: models.Group, as: "group", include: [{ model: models.Wallet, as: "wallet" }] },
        { model: models.Wallet, as: "wallet" },
      ],
      order: [["createdAt", "DESC"]],
    });

    const data = await Promise.all(
      sharedWallets.map(async (sw: any) => {
        const wallet = sw.groupId ? sw.group?.wallet : sw.wallet;
        const memberCount = sw.groupId
          ? sw.group?.memberCount ?? 0
          : await models.SharedWalletMember.count({ where: { sharedWalletId: sw.id, status: "active" } });
        return {
          id: sw.id,
          name: sw.name,
          groupId: sw.groupId || null,
          groupName: sw.group?.name || null,
          memberCount,
          withdrawalPolicy: sw.withdrawalPolicy,
          balance: wallet ? parseFloat(wallet.balance.toString()) : 0,
          currency: wallet ? wallet.currency : "RWF",
        };
      })
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    handleControllerError(res, error, "List my shared wallets");
  }
};

/** GET /shared-wallets/:id */
export const getSharedWalletById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet, group, wallet } = await resolveSharedWallet(models, id);
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    const memberCount = sharedWallet.groupId
      ? group?.memberCount ?? 0
      : await models.SharedWalletMember.count({ where: { sharedWalletId: sharedWallet.id, status: "active" } });

    res.status(200).json({
      success: true,
      data: {
        id: sharedWallet.id,
        name: sharedWallet.name,
        withdrawalPolicy: sharedWallet.withdrawalPolicy,
        groupId: sharedWallet.groupId || null,
        groupName: group?.name || null,
        memberCount,
        balance: parseFloat(wallet.balance.toString()),
        currency: wallet.currency || "RWF",
        userRole: membership.role,
        createdAt: sharedWallet.createdAt,
      },
    });
  } catch (error) {
    handleControllerError(res, error, "Get shared wallet");
  }
};

/** POST /shared-wallets/:id/deposit - any active member may add money in, no approval needed. */
export const deposit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { amount, pin, note } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new SharedWalletError(400, "A positive amount is required");
    }

    const { sharedWallet, wallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);
    await verifyTransactionPin(authenticatedUserId, pin);

    const memberWallet = await models.Wallet.findOne({ where: { userId: authenticatedUserId, isActive: true } });
    if (!memberWallet) throw new SharedWalletError(404, "Your wallet not found or inactive");

    const description = note || `Deposit into ${sharedWallet.name}`;

    let result: { transactionId: string } | null = null;
    await models.sequelize.transaction(async (t: DbTransaction) => {
      result = await depositIntoSharedWalletService(
        sharedWallet.id,
        wallet.id,
        memberWallet.id,
        parsedAmount,
        description,
        t
      );
    });

    const authenticatedUser = await models.User.findByPk(authenticatedUserId);
    const chatId = await getChatIdForSharedWallet(models, sharedWallet);
    if (chatId) {
      await postMoneyChatMessage(getIo(req), models, chatId, authenticatedUserId, {
        type: "shared_wallet_deposit",
        amount: parsedAmount,
        currency: wallet.currency || "RWF",
        senderName: authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "A member",
        sharedWalletId: sharedWallet.id,
        sharedWalletName: sharedWallet.name,
        groupId: sharedWallet.groupId || null,
        note: note || "",
        transactionId: (result as any)?.transactionId,
        timestamp: new Date().toISOString(),
      });
    }

    const newBalance = parseFloat(wallet.balance.toString()) + parsedAmount;
    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_balance_update", {
      balance: newBalance,
    });

    const otherMembers = (await listActiveMembers(models, sharedWallet)).filter(
      (m) => m.userId !== authenticatedUserId
    );
    await Promise.all(
      otherMembers.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_DEPOSIT_RECEIVED,
          recipientId: m.userId,
          data: {
            sharedWalletId: sharedWallet.id,
            sharedWalletName: sharedWallet.name,
            amount: parsedAmount,
            currency: wallet.currency || "RWF",
            message: `${authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "A member"} deposited ${parsedAmount} ${wallet.currency || "RWF"} into ${sharedWallet.name}`,
          },
        })
      )
    );

    res.status(200).json({ success: true, message: "Deposit completed", data: result });
  } catch (error) {
    handleControllerError(res, error, "Shared wallet deposit");
  }
};

/**
 * POST /shared-wallets/:id/withdraw
 * Free-mode withdrawal: moves money immediately, no approval step.
 */
export const withdrawFree = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { amount, pin, note } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new SharedWalletError(400, "A positive amount is required");
    }

    const { sharedWallet, wallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.withdrawalPolicy !== "free") {
      throw new SharedWalletError(400, "This shared wallet requires approval for withdrawals");
    }
    await resolveMembership(models, sharedWallet, authenticatedUserId);
    await verifyTransactionPin(authenticatedUserId, pin);

    const memberWallet = await models.Wallet.findOne({ where: { userId: authenticatedUserId, isActive: true } });
    if (!memberWallet) throw new SharedWalletError(404, "Your wallet not found or inactive");

    const description = note || `Withdrawal from ${sharedWallet.name}`;

    let result: { transactionId: string } | null = null;
    await models.sequelize.transaction(async (t: DbTransaction) => {
      result = await executeSharedWalletWithdrawal(wallet.id, memberWallet.id, parsedAmount, description, t);
    });

    const authenticatedUser = await models.User.findByPk(authenticatedUserId);
    const chatId = await getChatIdForSharedWallet(models, sharedWallet);
    if (chatId) {
      await postMoneyChatMessage(getIo(req), models, chatId, authenticatedUserId, {
        type: "shared_wallet_withdrawal",
        amount: parsedAmount,
        currency: wallet.currency || "RWF",
        senderName: sharedWallet.name,
        recipientName: authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "A member",
        sharedWalletId: sharedWallet.id,
        sharedWalletName: sharedWallet.name,
        groupId: sharedWallet.groupId || null,
        note: note || "",
        transactionId: (result as any)?.transactionId,
        timestamp: new Date().toISOString(),
      });
    }

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_balance_update", {
      balance: parseFloat(wallet.balance.toString()) - parsedAmount,
    });

    res.status(200).json({ success: true, message: "Withdrawal completed", data: result });
  } catch (error) {
    handleControllerError(res, error, "Shared wallet free withdrawal");
  }
};

/** POST /shared-wallets/:id/withdrawals - approval-mode: opens a request, no funds move yet. */
export const proposeWithdrawal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { amount, pin, note } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new SharedWalletError(400, "A positive amount is required");
    }

    const { sharedWallet, wallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.withdrawalPolicy !== "approval") {
      throw new SharedWalletError(400, "This shared wallet allows free withdrawals - no approval needed");
    }
    await resolveMembership(models, sharedWallet, authenticatedUserId);
    await verifyTransactionPin(authenticatedUserId, pin);

    const otherActiveCount = await countOtherActiveMembers(models, sharedWallet, authenticatedUserId);
    if (otherActiveCount < 1) {
      throw new SharedWalletError(400, "No other active members to approve this withdrawal");
    }
    const requiredApprovals = computeRequiredApprovals(otherActiveCount);

    const withdrawal = await models.SharedWalletWithdrawal.create({
      sharedWalletId: sharedWallet.id,
      walletId: wallet.id,
      requestedByUserId: authenticatedUserId,
      amount: parsedAmount,
      currency: wallet.currency || "RWF",
      note: note || null,
      status: "pending",
      requiredApprovals,
      approveCount: 0,
      declineCount: 0,
    } as any);

    const authenticatedUser = await models.User.findByPk(authenticatedUserId);
    const chatId = await getChatIdForSharedWallet(models, sharedWallet);
    if (chatId) {
      const message = await postMoneyChatMessage(getIo(req), models, chatId, authenticatedUserId, {
        type: "shared_wallet_withdrawal_request",
        withdrawalId: withdrawal.id,
        sharedWalletId: sharedWallet.id,
        groupId: sharedWallet.groupId || null,
        amount: parsedAmount,
        currency: withdrawal.currency,
        requesterId: authenticatedUserId,
        requesterName: authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "A member",
        note: note || "",
        status: "pending",
        requiredApprovals,
        approveCount: 0,
        declineCount: 0,
        timestamp: new Date().toISOString(),
      });
      await withdrawal.update({ chatMessageId: message.id });
    }

    const otherMembers = (await listActiveMembers(models, sharedWallet)).filter(
      (m) => m.userId !== authenticatedUserId
    );
    await Promise.all(
      otherMembers.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_WITHDRAWAL_REQUESTED,
          recipientId: m.userId,
          data: {
            sharedWalletId: sharedWallet.id,
            sharedWalletName: sharedWallet.name,
            withdrawalId: withdrawal.id,
            amount: parsedAmount,
            currency: withdrawal.currency,
            message: `${authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "A member"} requested to withdraw ${parsedAmount} ${withdrawal.currency} from ${sharedWallet.name}`,
          },
        })
      )
    );

    res.status(201).json({ success: true, message: "Withdrawal requested", data: withdrawal });
  } catch (error) {
    handleControllerError(res, error, "Propose shared wallet withdrawal");
  }
};

const loadPendingWithdrawal = async (
  models: ReturnType<typeof Models>,
  sharedWalletId: string,
  id: string,
  t?: DbTransaction
) => {
  const withdrawal = await models.SharedWalletWithdrawal.findByPk(
    id,
    t ? { lock: t.LOCK.UPDATE, transaction: t } : undefined
  );
  if (!withdrawal || withdrawal.sharedWalletId !== sharedWalletId) {
    throw new SharedWalletError(404, "Withdrawal request not found");
  }
  return withdrawal;
};

/** POST /shared-wallets/:id/withdrawals/:wid/approve */
export const approveWithdrawal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, wid } = req.params;
    const authenticatedUserId = req.user.id;
    const { pin } = req.body;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);
    await verifyTransactionPin(authenticatedUserId, pin);

    let updated: any;
    let executed = false;

    await models.sequelize.transaction(async (t: DbTransaction) => {
      const withdrawal = await loadPendingWithdrawal(models, sharedWallet.id, wid, t);
      if (withdrawal.status !== "pending") {
        throw new SharedWalletError(400, `Withdrawal cannot be approved from status '${withdrawal.status}'`);
      }
      if (withdrawal.requestedByUserId === authenticatedUserId) {
        throw new SharedWalletError(400, "You cannot approve your own withdrawal request");
      }
      const existingVote = await models.SharedWalletWithdrawalVote.findOne({
        where: { withdrawalId: withdrawal.id, userId: authenticatedUserId },
        transaction: t,
      });
      if (existingVote) throw new SharedWalletError(400, "You have already voted on this withdrawal request");

      await models.SharedWalletWithdrawalVote.create(
        { withdrawalId: withdrawal.id, userId: authenticatedUserId, decision: "approve" } as any,
        { transaction: t }
      );

      const newApproveCount = withdrawal.approveCount + 1;

      if (newApproveCount >= withdrawal.requiredApprovals) {
        const requesterWallet = await models.Wallet.findOne({
          where: { userId: withdrawal.requestedByUserId, isActive: true },
          transaction: t,
        });
        if (!requesterWallet) throw new SharedWalletError(404, "Requester's wallet not found or inactive");

        const result = await executeSharedWalletWithdrawal(
          withdrawal.walletId,
          requesterWallet.id,
          parseFloat(withdrawal.amount.toString()),
          withdrawal.note || `Withdrawal from ${sharedWallet.name}`,
          t,
          withdrawal.id
        );

        await withdrawal.update(
          {
            approveCount: newApproveCount,
            status: "approved",
            decidedAt: new Date(),
            transactionId: result.transactionId,
          },
          { transaction: t }
        );
        executed = true;
      } else {
        await withdrawal.update({ approveCount: newApproveCount }, { transaction: t });
      }

      updated = withdrawal;
    });

    if (updated.chatMessageId) {
      await updateSharedWalletWithdrawalMessage(getIo(req), models, updated.chatMessageId, {
        status: updated.status,
        approveCount: updated.approveCount,
        declineCount: updated.declineCount,
        transactionId: updated.transactionId,
      });
    }

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_withdrawal_updated", {
      withdrawalId: updated.id,
      status: updated.status,
      approveCount: updated.approveCount,
      declineCount: updated.declineCount,
      transactionId: updated.transactionId ?? null,
    });

    if (executed) {
      const pooledWallet = await models.Wallet.findByPk(updated.walletId);
      if (pooledWallet) {
        await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_balance_update", {
          balance: parseFloat(pooledWallet.balance.toString()),
        });
      }
      await createAndSendNotification(req.app, {
        type: NotificationType.SHARED_WALLET_WITHDRAWAL_EXECUTED,
        recipientId: updated.requestedByUserId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          withdrawalId: updated.id,
          amount: parseFloat(updated.amount.toString()),
          currency: updated.currency,
          transactionId: updated.transactionId,
          message: `Your withdrawal request for ${updated.amount} ${updated.currency} from ${sharedWallet.name} was approved and completed`,
        },
      });
    } else {
      const approver = await models.User.findByPk(authenticatedUserId);
      await createAndSendNotification(req.app, {
        type: NotificationType.SHARED_WALLET_WITHDRAWAL_APPROVED,
        recipientId: updated.requestedByUserId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          withdrawalId: updated.id,
          amount: parseFloat(updated.amount.toString()),
          currency: updated.currency,
          message: `${approver ? `${approver.firstName} ${approver.lastName}` : "A member"} approved your withdrawal request for ${updated.amount} ${updated.currency} from ${sharedWallet.name} (${updated.approveCount}/${updated.requiredApprovals})`,
        },
      });
    }

    res.status(200).json({ success: true, message: "Vote recorded", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Approve shared wallet withdrawal");
  }
};

/** POST /shared-wallets/:id/withdrawals/:wid/decline */
export const declineWithdrawal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, wid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    let updated: any;

    await models.sequelize.transaction(async (t: DbTransaction) => {
      const withdrawal = await loadPendingWithdrawal(models, sharedWallet.id, wid, t);
      if (withdrawal.status !== "pending") {
        throw new SharedWalletError(400, `Withdrawal cannot be declined from status '${withdrawal.status}'`);
      }
      if (withdrawal.requestedByUserId === authenticatedUserId) {
        throw new SharedWalletError(400, "You cannot decline your own withdrawal request");
      }
      const existingVote = await models.SharedWalletWithdrawalVote.findOne({
        where: { withdrawalId: withdrawal.id, userId: authenticatedUserId },
        transaction: t,
      });
      if (existingVote) throw new SharedWalletError(400, "You have already voted on this withdrawal request");

      await models.SharedWalletWithdrawalVote.create(
        { withdrawalId: withdrawal.id, userId: authenticatedUserId, decision: "decline" } as any,
        { transaction: t }
      );

      const newDeclineCount = withdrawal.declineCount + 1;
      const otherActiveCount = await countOtherActiveMembers(models, sharedWallet, withdrawal.requestedByUserId);
      const remainingVoters = otherActiveCount - (withdrawal.approveCount + newDeclineCount);
      const stillPossible = withdrawal.approveCount + remainingVoters >= withdrawal.requiredApprovals;

      if (!stillPossible) {
        await withdrawal.update(
          { declineCount: newDeclineCount, status: "declined", decidedAt: new Date() },
          { transaction: t }
        );
      } else {
        await withdrawal.update({ declineCount: newDeclineCount }, { transaction: t });
      }

      updated = withdrawal;
    });

    if (updated.chatMessageId) {
      await updateSharedWalletWithdrawalMessage(getIo(req), models, updated.chatMessageId, {
        status: updated.status,
        approveCount: updated.approveCount,
        declineCount: updated.declineCount,
        transactionId: updated.transactionId,
      });
    }

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_withdrawal_updated", {
      withdrawalId: updated.id,
      status: updated.status,
      approveCount: updated.approveCount,
      declineCount: updated.declineCount,
      transactionId: updated.transactionId ?? null,
    });

    if (updated.status === "declined") {
      await createAndSendNotification(req.app, {
        type: NotificationType.SHARED_WALLET_WITHDRAWAL_DECLINED,
        recipientId: updated.requestedByUserId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          withdrawalId: updated.id,
          amount: parseFloat(updated.amount.toString()),
          currency: updated.currency,
          message: `Your withdrawal request for ${updated.amount} ${updated.currency} from ${sharedWallet.name} was declined`,
        },
      });
    }

    res.status(200).json({ success: true, message: "Vote recorded", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Decline shared wallet withdrawal");
  }
};

/** POST /shared-wallets/:id/withdrawals/:wid/cancel - only the requester can cancel their own pending request. */
export const cancelWithdrawal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, wid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    const withdrawal = await loadPendingWithdrawal(models, sharedWallet.id, wid);
    if (withdrawal.requestedByUserId !== authenticatedUserId) {
      throw new SharedWalletError(403, "Only the requester can cancel this withdrawal");
    }
    if (withdrawal.status !== "pending") {
      throw new SharedWalletError(400, `Withdrawal cannot be cancelled from status '${withdrawal.status}'`);
    }

    await withdrawal.update({ status: "cancelled", decidedAt: new Date() });

    if (withdrawal.chatMessageId) {
      await updateSharedWalletWithdrawalMessage(getIo(req), models, withdrawal.chatMessageId, {
        status: withdrawal.status,
        approveCount: withdrawal.approveCount,
        declineCount: withdrawal.declineCount,
        transactionId: withdrawal.transactionId,
      });
    }

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_withdrawal_updated", {
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      approveCount: withdrawal.approveCount,
      declineCount: withdrawal.declineCount,
      transactionId: withdrawal.transactionId ?? null,
    });

    res.status(200).json({ success: true, message: "Withdrawal request cancelled", data: withdrawal });
  } catch (error) {
    handleControllerError(res, error, "Cancel shared wallet withdrawal");
  }
};

/** GET /shared-wallets/:id/withdrawals/:wid - polled by the withdrawal-request card for live status. */
export const getWithdrawalById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, wid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    const withdrawal = await models.SharedWalletWithdrawal.findByPk(wid, {
      include: [{ model: models.SharedWalletWithdrawalVote, as: "votes" }],
    });
    if (!withdrawal || withdrawal.sharedWalletId !== sharedWallet.id) {
      throw new SharedWalletError(404, "Withdrawal request not found");
    }

    res.status(200).json({ success: true, data: withdrawal });
  } catch (error) {
    handleControllerError(res, error, "Get shared wallet withdrawal");
  }
};

/**
 * GET /shared-wallets/:id/activity
 * Unified feed: money that actually moved (Transactions on the pooled wallet) plus
 * withdrawal requests (including still-pending ones, which have no Transaction yet).
 */
export const getActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const limit = Math.min(parseInt(String(req.query.limit || "30"), 10) || 30, 100);

    const { sharedWallet, wallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    const userAttrs = ["id", "firstName", "lastName"];
    const [transactions, withdrawals] = await Promise.all([
      models.Transaction.findAll({
        where: { [Op.or]: [{ senderWalletId: wallet.id }, { receiverWalletId: wallet.id }] },
        order: [["createdAt", "DESC"]],
        limit,
        include: [
          { model: models.Wallet, as: "senderWallet", attributes: ["id", "userId"], include: [{ model: models.User, as: "user", attributes: userAttrs, required: false }] },
          { model: models.Wallet, as: "receiverWallet", attributes: ["id", "userId"], include: [{ model: models.User, as: "user", attributes: userAttrs, required: false }] },
        ],
      }),
      models.SharedWalletWithdrawal.findAll({
        where: { sharedWalletId: sharedWallet.id },
        order: [["createdAt", "DESC"]],
        limit,
        include: [{ model: models.User, as: "requestedBy", attributes: userAttrs, required: false }],
      }),
    ]);

    const nameOf = (user: any): string | null => (user ? `${user.firstName} ${user.lastName}` : null);

    const transactionEntries = transactions.map((t: any) => {
      const isDeposit = t.receiverWalletId === wallet.id;
      // The member on the "other side" of the pooled wallet - who deposited or who
      // received the withdrawal - not the wallet itself.
      const personUser = isDeposit ? t.senderWallet?.user : t.receiverWallet?.user;
      return {
        kind: "transaction",
        id: t.id,
        type: isDeposit ? "deposit" : "withdrawal",
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        description: t.description,
        personName: nameOf(personUser),
        createdAt: t.createdAt,
      };
    });

    // Pending requests have no Transaction yet - surface them too so the Activity tab
    // shows "awaiting approval" items, not just completed money movements.
    const pendingWithdrawalEntries = withdrawals
      .filter((w: any) => w.status === "pending")
      .map((w: any) => ({
        kind: "withdrawal_request",
        id: w.id,
        status: w.status,
        amount: parseFloat(w.amount.toString()),
        currency: w.currency,
        requestedByUserId: w.requestedByUserId,
        requestedByName: nameOf(w.requestedBy),
        requiredApprovals: w.requiredApprovals,
        approveCount: w.approveCount,
        declineCount: w.declineCount,
        note: w.note,
        createdAt: w.createdAt,
      }));

    const combined = [...transactionEntries, ...pendingWithdrawalEntries].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.status(200).json({ success: true, data: combined.slice(0, limit) });
  } catch (error) {
    handleControllerError(res, error, "Get shared wallet activity");
  }
};

/** GET /shared-wallets/:id/members */
export const listMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    const members = await listActiveMembers(models, sharedWallet);
    const users = await models.User.findAll({
      where: { id: { [Op.in]: members.map((m) => m.userId) } },
      attributes: ["id", "firstName", "lastName"],
    });
    const usersById = new Map(users.map((u) => [u.id, u]));

    const data = members.map((m) => {
      const user = usersById.get(m.userId);
      return {
        userId: m.userId,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        role: m.role,
        status: m.status,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    handleControllerError(res, error, "List shared wallet members");
  }
};

/**
 * POST /shared-wallets/:id/members - STANDALONE wallets only. A group-attached shared
 * wallet's membership follows the group - invite members via `POST /groups/invite`.
 */
export const addMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { userId: newMemberId } = req.body;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's membership - invite via the group instead");
    }
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new SharedWalletError(403, "Only owners and admins can add members");
    }
    if (!newMemberId) throw new SharedWalletError(400, "userId is required");

    const contact = await models.Contact.findOne({
      where: {
        [Op.or]: [
          { userAId: authenticatedUserId, userBId: newMemberId },
          { userAId: newMemberId, userBId: authenticatedUserId },
        ],
        status: "active",
      },
    });
    if (!contact) throw new SharedWalletError(400, "That user must be in your contacts");

    const existing = await models.SharedWalletMember.findOne({
      where: { sharedWalletId: sharedWallet.id, userId: newMemberId },
    });
    let membershipId: string;
    if (existing) {
      if (existing.status === "active") throw new SharedWalletError(400, "Already a member");
      if (existing.status === "pending") throw new SharedWalletError(400, "Already has a pending invitation");
      await existing.update({ status: "pending", role: "member" });
      membershipId = existing.id;
    } else {
      const created = await models.SharedWalletMember.create(
        { sharedWalletId: sharedWallet.id, userId: newMemberId, role: "member", status: "pending" } as any
      );
      membershipId = created.id;
    }

    const adder = await models.User.findByPk(authenticatedUserId);
    await createAndSendNotification(req.app, {
      type: NotificationType.SHARED_WALLET_INVITATION,
      recipientId: newMemberId,
      data: {
        sharedWalletId: sharedWallet.id,
        sharedWalletName: sharedWallet.name,
        membershipId,
        userId: authenticatedUserId,
        userName: adder ? `${adder.firstName} ${adder.lastName}` : "Someone",
        message: `${adder ? `${adder.firstName} ${adder.lastName}` : "Someone"} invited you to join the shared wallet '${sharedWallet.name}'`,
      },
    });

    res.status(200).json({ success: true, message: "Invitation sent" });
  } catch (error) {
    handleControllerError(res, error, "Add shared wallet member");
  }
};

/** DELETE /shared-wallets/:id/members/:userId - STANDALONE wallets only. */
export const removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, userId: targetUserId } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's membership - remove via the group instead");
    }
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new SharedWalletError(403, "Only owners and admins can remove members");
    }

    const target = await models.SharedWalletMember.findOne({
      where: { sharedWalletId: sharedWallet.id, userId: targetUserId, status: { [Op.in]: ["active", "pending"] } },
    });
    if (!target) throw new SharedWalletError(404, "Member not found");
    if (target.role === "owner") throw new SharedWalletError(400, "Cannot remove the wallet owner");

    const wasPending = target.status === "pending";
    await target.update({ status: "removed" });

    res.status(200).json({ success: true, message: wasPending ? "Invitation cancelled" : "Member removed" });
  } catch (error) {
    handleControllerError(res, error, "Remove shared wallet member");
  }
};

/** GET /shared-wallets/:id/pending-members - STANDALONE wallets only, owner/admin-only. */
export const listPendingMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's membership");
    }
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new SharedWalletError(403, "Only owners and admins can view pending invitations");
    }

    const pending = await models.SharedWalletMember.findAll({
      where: { sharedWalletId: sharedWallet.id, status: "pending" },
    });
    const users = await models.User.findAll({
      where: { id: { [Op.in]: pending.map((m) => m.userId) } },
      attributes: ["id", "firstName", "lastName"],
    });
    const usersById = new Map(users.map((u) => [u.id, u]));

    const data = pending.map((m) => {
      const user = usersById.get(m.userId);
      return {
        userId: m.userId,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    handleControllerError(res, error, "List pending shared wallet invitations");
  }
};

/** POST /shared-wallets/:id/leave - STANDALONE wallets only. */
export const leaveSharedWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's membership - leave via the group instead");
    }
    const membership = await models.SharedWalletMember.findOne({
      where: { sharedWalletId: sharedWallet.id, userId: authenticatedUserId, status: "active" },
    });
    if (!membership) throw new SharedWalletError(404, "You are not a member of this shared wallet");
    if (membership.role === "owner") {
      throw new SharedWalletError(
        400,
        "The owner cannot leave directly - transfer ownership to another member, or delete the wallet (only possible at a zero balance) first."
      );
    }

    await membership.update({ status: "left" });

    res.status(200).json({ success: true, message: "Left the shared wallet" });
  } catch (error) {
    handleControllerError(res, error, "Leave shared wallet");
  }
};

/** POST /shared-wallets/:id/transfer-ownership - STANDALONE wallets only. */
export const transferOwnership = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { newOwnerUserId } = req.body;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's ownership - transfer ownership via the group instead");
    }
    if (!newOwnerUserId) throw new SharedWalletError(400, "newOwnerUserId is required");
    if (newOwnerUserId === authenticatedUserId) throw new SharedWalletError(400, "You are already the owner");

    await models.sequelize.transaction(async (t: DbTransaction) => {
      const currentOwner = await models.SharedWalletMember.findOne({
        where: { sharedWalletId: sharedWallet.id, userId: authenticatedUserId, status: "active", role: "owner" },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!currentOwner) throw new SharedWalletError(403, "Only the current owner can transfer ownership");

      const target = await models.SharedWalletMember.findOne({
        where: { sharedWalletId: sharedWallet.id, userId: newOwnerUserId, status: "active" },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!target) throw new SharedWalletError(404, "Target user is not an active member of this shared wallet");

      await target.update({ role: "owner" }, { transaction: t });
      await currentOwner.update({ role: "admin" }, { transaction: t });
    });

    await createAndSendNotification(req.app, {
      type: NotificationType.SHARED_WALLET_OWNERSHIP_TRANSFERRED,
      recipientId: newOwnerUserId,
      data: {
        sharedWalletId: sharedWallet.id,
        sharedWalletName: sharedWallet.name,
        message: `You are now the owner of the shared wallet '${sharedWallet.name}'`,
      },
    });

    res.status(200).json({ success: true, message: "Ownership transferred" });
  } catch (error) {
    handleControllerError(res, error, "Transfer shared wallet ownership");
  }
};

/** DELETE /shared-wallets/:id - STANDALONE wallets only, owner-only, requires a zero balance. */
export const deleteSharedWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet, wallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group - delete the group instead");
    }
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (membership.role !== "owner") {
      throw new SharedWalletError(403, "Only the owner can delete this shared wallet");
    }
    const currentBalance = parseFloat(wallet.balance.toString());
    if (currentBalance !== 0) {
      throw new SharedWalletError(400, "Withdraw the remaining balance before deleting this wallet");
    }
    const pendingCount = await models.SharedWalletWithdrawal.count({
      where: { sharedWalletId: sharedWallet.id, status: "pending" },
    });
    if (pendingCount > 0) {
      throw new SharedWalletError(400, "Resolve pending withdrawal requests before deleting this wallet");
    }

    const activeMemberIds = (await listActiveMembers(models, sharedWallet))
      .map((m) => m.userId)
      .filter((uid) => uid !== authenticatedUserId);
    const pendingInviteeIds = (
      await models.SharedWalletMember.findAll({
        where: { sharedWalletId: sharedWallet.id, status: "pending" },
        attributes: ["userId"],
      })
    ).map((m) => m.userId);
    const notifyIds = Array.from(new Set([...activeMemberIds, ...pendingInviteeIds]));

    const walletName = sharedWallet.name;
    await sharedWallet.destroy();

    const deleter = await models.User.findByPk(authenticatedUserId);
    await Promise.all(
      notifyIds.map((uid) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_DELETED,
          recipientId: uid,
          data: {
            sharedWalletName: walletName,
            message: `${deleter ? `${deleter.firstName} ${deleter.lastName}` : "The owner"} deleted the shared wallet '${walletName}'`,
          },
        })
      )
    );

    res.status(200).json({ success: true, message: "Shared wallet deleted" });
  } catch (error) {
    handleControllerError(res, error, "Delete shared wallet");
  }
};

/**
 * POST /shared-wallets/:id/invitations/:membershipId/respond
 * Accept or decline a pending invitation to a STANDALONE shared wallet.
 */
export const respondToSharedWalletInvitation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, membershipId } = req.params;
    const { action } = req.body;
    const authenticatedUserId = req.user.id;

    if (action !== "accept" && action !== "reject") {
      throw new SharedWalletError(400, "action must be 'accept' or 'reject'");
    }

    const { sharedWallet } = await resolveSharedWallet(models, id);
    const membership = await models.SharedWalletMember.findOne({
      where: { id: membershipId, sharedWalletId: sharedWallet.id, userId: authenticatedUserId, status: "pending" },
    });
    if (!membership) throw new SharedWalletError(404, "Invitation not found or already responded to");

    await membership.update({ status: action === "accept" ? "active" : "removed" });

    const owner = await models.SharedWalletMember.findOne({
      where: { sharedWalletId: sharedWallet.id, role: "owner", status: "active" },
    });
    const responder = await models.User.findByPk(authenticatedUserId);
    const responderName = responder ? `${responder.firstName} ${responder.lastName}` : "Someone";
    if (owner) {
      await createAndSendNotification(req.app, {
        type: action === "accept" ? NotificationType.SHARED_WALLET_INVITATION_ACCEPTED : NotificationType.SHARED_WALLET_INVITATION_REJECTED,
        recipientId: owner.userId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          userId: authenticatedUserId,
          userName: responderName,
          message: `${responderName} ${action === "accept" ? "accepted" : "declined"} the invitation to '${sharedWallet.name}'`,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: action === "accept" ? "Joined the shared wallet" : "Invitation declined",
    });
  } catch (error) {
    handleControllerError(res, error, "Respond to shared wallet invitation");
  }
};

/**
 * GET /shared-wallets/invitations/pending
 * Lists the authenticated user's still-pending shared wallet invitations, so the
 * notification center can resolve a membershipId to accept/reject against.
 */
export const getPendingSharedWalletInvitations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const pending = await models.SharedWalletMember.findAll({
      where: { userId, status: "pending" },
      include: [{ model: models.SharedWallet, as: "sharedWallet" }],
    });

    res.status(200).json({
      success: true,
      data: pending.map((p: any) => ({
        id: p.id,
        sharedWalletId: p.sharedWalletId,
        sharedWalletName: p.sharedWallet?.name,
      })),
    });
  } catch (error) {
    handleControllerError(res, error, "Get pending shared wallet invitations");
  }
};

/**
 * PATCH /shared-wallets/:id/policy
 * Instant tightening only (free -> approval). Owner/admin-only, no PIN (not a money
 * movement). Loosening (approval -> free) always goes through a quorum vote instead -
 * see proposePolicyChange below.
 */
export const updateWithdrawalPolicyInstant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    const { policy } = req.body;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's policy settings");
    }
    const membership = await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new SharedWalletError(403, "Only owners and admins can tighten the withdrawal policy");
    }
    if (policy !== "approval") {
      throw new SharedWalletError(400, "Only tightening (to 'approval') is instant - loosening requires a proposal");
    }
    if (sharedWallet.withdrawalPolicy === "approval") {
      throw new SharedWalletError(400, "This shared wallet already requires approval");
    }

    await sharedWallet.update({ withdrawalPolicy: "approval" });

    const others = (await listActiveMembers(models, sharedWallet)).filter((m) => m.userId !== authenticatedUserId);
    await Promise.all(
      others.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_POLICY_CHANGED,
          recipientId: m.userId,
          data: {
            sharedWalletId: sharedWallet.id,
            sharedWalletName: sharedWallet.name,
            message: `'${sharedWallet.name}' now requires approval for withdrawals`,
          },
        })
      )
    );

    res.status(200).json({ success: true, message: "Withdrawal policy updated" });
  } catch (error) {
    handleControllerError(res, error, "Update shared wallet policy");
  }
};

/**
 * POST /shared-wallets/:id/policy-changes
 * Proposes loosening the withdrawal policy (approval -> free). Requires the same
 * majority quorum as a withdrawal request - see proposeWithdrawal for the pattern.
 */
export const proposePolicyChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    if (sharedWallet.groupId) {
      throw new SharedWalletError(400, "This shared wallet follows its group's policy settings");
    }
    await resolveMembership(models, sharedWallet, authenticatedUserId);
    if (sharedWallet.withdrawalPolicy !== "approval") {
      throw new SharedWalletError(400, "This shared wallet already allows free withdrawals");
    }

    const existingPending = await models.SharedWalletPolicyChange.count({
      where: { sharedWalletId: sharedWallet.id, status: "pending" },
    });
    if (existingPending > 0) {
      throw new SharedWalletError(400, "A policy change is already pending a vote");
    }

    const otherActiveCount = await countOtherActiveMembers(models, sharedWallet, authenticatedUserId);
    if (otherActiveCount < 1) {
      throw new SharedWalletError(400, "No other active members to approve this change");
    }
    const requiredApprovals = computeRequiredApprovals(otherActiveCount);

    const policyChange = await models.SharedWalletPolicyChange.create({
      sharedWalletId: sharedWallet.id,
      proposedByUserId: authenticatedUserId,
      targetPolicy: "free",
      status: "pending",
      requiredApprovals,
      approveCount: 0,
      declineCount: 0,
    } as any);

    const proposer = await models.User.findByPk(authenticatedUserId);
    const otherMembers = (await listActiveMembers(models, sharedWallet)).filter(
      (m) => m.userId !== authenticatedUserId
    );
    await Promise.all(
      otherMembers.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.SHARED_WALLET_POLICY_CHANGE_PROPOSED,
          recipientId: m.userId,
          data: {
            sharedWalletId: sharedWallet.id,
            sharedWalletName: sharedWallet.name,
            message: `${proposer ? `${proposer.firstName} ${proposer.lastName}` : "A member"} proposed switching '${sharedWallet.name}' to free withdrawals`,
          },
        })
      )
    );

    res.status(201).json({ success: true, message: "Policy change proposed", data: policyChange });
  } catch (error) {
    handleControllerError(res, error, "Propose shared wallet policy change");
  }
};

/** GET /shared-wallets/:id/policy-changes/pending - the current in-flight proposal, if any. */
export const getPendingPolicyChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    const policyChange = await models.SharedWalletPolicyChange.findOne({
      where: { sharedWalletId: sharedWallet.id, status: "pending" },
      include: [{ model: models.User, as: "proposedBy", attributes: ["id", "firstName", "lastName"] }],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({ success: true, data: policyChange });
  } catch (error) {
    handleControllerError(res, error, "Get pending shared wallet policy change");
  }
};

const loadPendingPolicyChange = async (
  models: ReturnType<typeof Models>,
  sharedWalletId: string,
  id: string,
  t?: DbTransaction
) => {
  const policyChange = await models.SharedWalletPolicyChange.findByPk(
    id,
    t ? { lock: t.LOCK.UPDATE, transaction: t } : undefined
  );
  if (!policyChange || policyChange.sharedWalletId !== sharedWalletId) {
    throw new SharedWalletError(404, "Policy change request not found");
  }
  return policyChange;
};

/** POST /shared-wallets/:id/policy-changes/:pcid/approve */
export const approvePolicyChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, pcid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    let updated: any;
    let executed = false;

    await models.sequelize.transaction(async (t: DbTransaction) => {
      const policyChange = await loadPendingPolicyChange(models, sharedWallet.id, pcid, t);
      if (policyChange.status !== "pending") {
        throw new SharedWalletError(400, `Policy change cannot be approved from status '${policyChange.status}'`);
      }
      if (policyChange.proposedByUserId === authenticatedUserId) {
        throw new SharedWalletError(400, "You cannot approve your own policy change proposal");
      }
      const existingVote = await models.SharedWalletPolicyChangeVote.findOne({
        where: { policyChangeId: policyChange.id, userId: authenticatedUserId },
        transaction: t,
      });
      if (existingVote) throw new SharedWalletError(400, "You have already voted on this policy change");

      await models.SharedWalletPolicyChangeVote.create(
        { policyChangeId: policyChange.id, userId: authenticatedUserId, decision: "approve" } as any,
        { transaction: t }
      );

      const newApproveCount = policyChange.approveCount + 1;

      if (newApproveCount >= policyChange.requiredApprovals) {
        await sharedWallet.update({ withdrawalPolicy: policyChange.targetPolicy }, { transaction: t });
        await policyChange.update(
          { approveCount: newApproveCount, status: "approved", decidedAt: new Date() },
          { transaction: t }
        );
        executed = true;
      } else {
        await policyChange.update({ approveCount: newApproveCount }, { transaction: t });
      }

      updated = policyChange;
    });

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_policy_change_updated", {
      policyChangeId: updated.id,
      status: updated.status,
      approveCount: updated.approveCount,
      declineCount: updated.declineCount,
    });

    if (executed) {
      await createAndSendNotification(req.app, {
        type: NotificationType.SHARED_WALLET_POLICY_CHANGE_APPROVED,
        recipientId: updated.proposedByUserId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          message: `'${sharedWallet.name}' now allows free withdrawals`,
        },
      });
    }

    res.status(200).json({ success: true, message: "Vote recorded", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Approve shared wallet policy change");
  }
};

/** POST /shared-wallets/:id/policy-changes/:pcid/decline */
export const declinePolicyChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, pcid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    await resolveMembership(models, sharedWallet, authenticatedUserId);

    let updated: any;

    await models.sequelize.transaction(async (t: DbTransaction) => {
      const policyChange = await loadPendingPolicyChange(models, sharedWallet.id, pcid, t);
      if (policyChange.status !== "pending") {
        throw new SharedWalletError(400, `Policy change cannot be declined from status '${policyChange.status}'`);
      }
      if (policyChange.proposedByUserId === authenticatedUserId) {
        throw new SharedWalletError(400, "You cannot decline your own policy change proposal");
      }
      const existingVote = await models.SharedWalletPolicyChangeVote.findOne({
        where: { policyChangeId: policyChange.id, userId: authenticatedUserId },
        transaction: t,
      });
      if (existingVote) throw new SharedWalletError(400, "You have already voted on this policy change");

      await models.SharedWalletPolicyChangeVote.create(
        { policyChangeId: policyChange.id, userId: authenticatedUserId, decision: "decline" } as any,
        { transaction: t }
      );

      const newDeclineCount = policyChange.declineCount + 1;
      const otherActiveCount = await countOtherActiveMembers(models, sharedWallet, policyChange.proposedByUserId);
      const remainingVoters = otherActiveCount - (policyChange.approveCount + newDeclineCount);
      const stillPossible = policyChange.approveCount + remainingVoters >= policyChange.requiredApprovals;

      if (!stillPossible) {
        await policyChange.update(
          { declineCount: newDeclineCount, status: "declined", decidedAt: new Date() },
          { transaction: t }
        );
      } else {
        await policyChange.update({ declineCount: newDeclineCount }, { transaction: t });
      }

      updated = policyChange;
    });

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_policy_change_updated", {
      policyChangeId: updated.id,
      status: updated.status,
      approveCount: updated.approveCount,
      declineCount: updated.declineCount,
    });

    if (updated.status === "declined") {
      await createAndSendNotification(req.app, {
        type: NotificationType.SHARED_WALLET_POLICY_CHANGE_DECLINED,
        recipientId: updated.proposedByUserId,
        data: {
          sharedWalletId: sharedWallet.id,
          sharedWalletName: sharedWallet.name,
          message: `Your proposal to switch '${sharedWallet.name}' to free withdrawals was declined`,
        },
      });
    }

    res.status(200).json({ success: true, message: "Vote recorded", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Decline shared wallet policy change");
  }
};

/** POST /shared-wallets/:id/policy-changes/:pcid/cancel - only the proposer can cancel. */
export const cancelPolicyChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const { id, pcid } = req.params;
    const authenticatedUserId = req.user.id;

    const { sharedWallet } = await resolveSharedWallet(models, id);
    const policyChange = await loadPendingPolicyChange(models, sharedWallet.id, pcid);
    if (policyChange.proposedByUserId !== authenticatedUserId) {
      throw new SharedWalletError(403, "Only the proposer can cancel this policy change");
    }
    if (policyChange.status !== "pending") {
      throw new SharedWalletError(400, `Policy change cannot be cancelled from status '${policyChange.status}'`);
    }

    await policyChange.update({ status: "cancelled", decidedAt: new Date() });

    await broadcastToSharedWalletMembers(getIo(req), models, sharedWallet, "shared_wallet_policy_change_updated", {
      policyChangeId: policyChange.id,
      status: policyChange.status,
      approveCount: policyChange.approveCount,
      declineCount: policyChange.declineCount,
    });

    res.status(200).json({ success: true, message: "Policy change cancelled", data: policyChange });
  } catch (error) {
    handleControllerError(res, error, "Cancel shared wallet policy change");
  }
};
