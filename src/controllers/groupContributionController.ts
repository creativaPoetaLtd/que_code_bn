import { Response } from "express";
import { Op } from "sequelize";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import { GroupMemberRole, GroupMemberStatus } from "../types/group";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification } from "../utils/notificationService";

// ─── helpers ────────────────────────────────────────────────────────────────

const getModels = (req: AuthenticatedRequest) =>
  req.app.get("models") as ReturnType<typeof Models>;

const isGroupAdmin = async (
  models: ReturnType<typeof Models>,
  groupId: string,
  userId: string
) =>
  models.GroupMember.findOne({
    where: {
      groupId,
      userId,
      status: GroupMemberStatus.ACTIVE,
      role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
    },
  });

const isActiveMember = async (
  models: ReturnType<typeof Models>,
  groupId: string,
  userId: string
) =>
  models.GroupMember.findOne({
    where: { groupId, userId, status: GroupMemberStatus.ACTIVE },
  });

// ─── createContribution ─────────────────────────────────────────────────────

export const createContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const userId = req.user.id;

    const adminMembership = await isGroupAdmin(models, groupId, userId);
    if (!adminMembership) {
      res.status(403).json({
        success: false,
        message: "Only group admins can create contribution requests",
      });
      return;
    }

    const {
      title,
      note,
      goalAmount,
      type,
      amountPerMember,
      minimumAmount,
      deadline,
      visibilityMode,
      disbursementPolicy,
      disbursementRecipientId,
    } = req.body;

    if (!title || !type) {
      res.status(400).json({
        success: false,
        message: "title and type are required",
      });
      return;
    }

    if (type !== "fixed" && type !== "flexible") {
      res
        .status(400)
        .json({ success: false, message: "type must be 'fixed' or 'flexible'" });
      return;
    }

    if (goalAmount != null && Number(goalAmount) <= 0) {
      res
        .status(400)
        .json({ success: false, message: "goalAmount must be greater than 0" });
      return;
    }

    if (type === "fixed") {
      if (!amountPerMember || Number(amountPerMember) <= 0) {
        res.status(400).json({
          success: false,
          message:
            "A positive amountPerMember is required for fixed contributions",
        });
        return;
      }
    }

    if (type === "flexible" && minimumAmount && Number(minimumAmount) <= 0) {
      res.status(400).json({
        success: false,
        message: "minimumAmount must be greater than 0",
      });
      return;
    }

    if (deadline && new Date(deadline) <= new Date()) {
      res
        .status(400)
        .json({ success: false, message: "deadline must be in the future" });
      return;
    }

    const resolvedPolicy = disbursementPolicy === "auto" ? "auto" : "hold";

    if (resolvedPolicy === "auto") {
      if (!disbursementRecipientId) {
        res.status(400).json({
          success: false,
          message: "disbursementRecipientId is required when policy is auto",
        });
        return;
      }
      const recipientMembership = await models.GroupMember.findOne({
        where: {
          groupId,
          userId: disbursementRecipientId,
          status: GroupMemberStatus.ACTIVE,
          role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
        },
      });
      if (!recipientMembership) {
        res.status(400).json({
          success: false,
          message: "Disbursement recipient must be an active admin or owner of this group",
        });
        return;
      }
    }

    // Ensure the group has a wallet — create one on-demand if missing
    const group = await models.Group.findByPk(groupId);
    if (!group) {
      res.status(404).json({ success: false, message: "Group not found" });
      return;
    }

    if (!group.walletId) {
      const wallet = await models.Wallet.create({
        groupId: group.id,
        balance: 0,
      });
      await group.update({ walletId: wallet.id });
    }

    const contribution = await models.GroupContribution.create({
      groupId,
      createdBy: userId,
      title: String(title).trim(),
      note: note ? String(note).trim() : null,
      goalAmount: goalAmount != null ? Number(goalAmount) : null,
      type,
      amountPerMember: type === "fixed" ? Number(amountPerMember) : null,
      minimumAmount:
        type === "flexible" && minimumAmount ? Number(minimumAmount) : null,
      deadline: deadline ? new Date(deadline) : null,
      visibilityMode: visibilityMode === "admin_only" ? "admin_only" : "all",
      disbursementPolicy: resolvedPolicy,
      disbursementRecipientId: resolvedPolicy === "auto" ? disbursementRecipientId : null,
    });

    const allMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        userId: { [Op.ne]: userId },
      },
      attributes: ["userId"],
    });

    const io = req.app.get("io");
    if (io) {
      allMembers.forEach((member) => {
        io.to(`user_${member.userId}`).emit("group_contribution_created", {
          groupId,
          contributionId: contribution.id,
          title: contribution.title,
          goalAmount: contribution.goalAmount,
          type: contribution.type,
          amountPerMember: contribution.amountPerMember,
          minimumAmount: contribution.minimumAmount,
          deadline: contribution.deadline,
          visibilityMode: contribution.visibilityMode,
        });
      });
    }

    await Promise.all(
      allMembers.map((member) =>
        createAndSendNotification(req.app, {
          type: NotificationType.GROUP_CONTRIBUTION_CREATED,
          recipientId: member.userId,
          data: {
            groupId,
            contributionId: contribution.id,
            contributionTitle: contribution.title,
            amount: contribution.goalAmount ?? undefined,
            message: `A new contribution request "${contribution.title}" has been created`,
          },
        })
      )
    );

    res.status(201).json({
      success: true,
      message: "Contribution request created successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("createContribution error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── disburseFunds (internal) ────────────────────────────────────────────────

const disburseFunds = async (
  models: ReturnType<typeof Models>,
  contribution: InstanceType<ReturnType<typeof Models>["GroupContribution"]>,
  io?: any
) => {
  if (contribution.disbursementPolicy !== "auto" || !contribution.disbursementRecipientId) return;

  const collectedAmount = parseFloat(contribution.collectedAmount.toString());
  if (collectedAmount <= 0) return;

  const groupWallet = await models.Wallet.findOne({ where: { groupId: contribution.groupId } });
  const recipientWallet = await models.Wallet.findOne({ where: { userId: contribution.disbursementRecipientId } });

  if (!groupWallet || !recipientWallet || !recipientWallet.isActive) {
    console.warn(`disburseFunds: wallet missing or inactive for contribution ${contribution.id}`);
    return;
  }

  const groupBalance = parseFloat(groupWallet.balance.toString());
  if (groupBalance < collectedAmount) {
    console.warn(`disburseFunds: group wallet balance (${groupBalance}) < collectedAmount (${collectedAmount}) for contribution ${contribution.id}`);
    return;
  }

  const dbTx = await models.sequelize.transaction();
  try {
    await groupWallet.update({ balance: groupBalance - collectedAmount }, { transaction: dbTx });
    const recipientBalance = parseFloat(recipientWallet.balance.toString());
    await recipientWallet.update({ balance: recipientBalance + collectedAmount }, { transaction: dbTx });

    await models.Transaction.create(
      {
        referenceId: uuidv4(),
        senderWalletId: groupWallet.id,
        receiverWalletId: recipientWallet.id,
        amount: collectedAmount,
        totalAmount: collectedAmount,
        currency: "RWF",
        status: "completed",
        type: "transfer",
        description: `Contribution disbursement: ${contribution.title}`,
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    if (io) {
      io.to(`user_${contribution.disbursementRecipientId}`).emit("group_contribution_disbursed", {
        groupId: contribution.groupId,
        contributionId: contribution.id,
        amount: collectedAmount,
      });
    }
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
};

// ─── contribute (member pays) ────────────────────────────────────────────────

export const contribute = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;
    const { amount, pin } = req.body;

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      res.status(400).json({
        success: false,
        message: "A valid 4-digit PIN is required",
      });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      res
        .status(400)
        .json({ success: false, message: "A valid amount is required" });
      return;
    }

    const membership = await isActiveMember(models, groupId, userId);
    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You are not an active member of this group",
      });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });

    if (!contribution) {
      res
        .status(404)
        .json({ success: false, message: "Contribution not found" });
      return;
    }

    // Auto-expire if deadline has passed
    if (
      contribution.status === "active" &&
      contribution.deadline &&
      new Date(contribution.deadline) < new Date()
    ) {
      await contribution.update({ status: "expired" });
      res.status(400).json({
        success: false,
        message: "This contribution request has expired",
      });
      return;
    }

    if (contribution.status !== "active") {
      res.status(400).json({
        success: false,
        message: `This contribution is ${contribution.status} and no longer accepting payments`,
      });
      return;
    }

    const contributionAmount = Number(amount);

    if (contribution.type === "fixed") {
      if (contributionAmount !== Number(contribution.amountPerMember)) {
        res.status(400).json({
          success: false,
          message: `Fixed contributions must be exactly ${contribution.amountPerMember} RWF`,
        });
        return;
      }
    }

    if (contribution.type === "flexible" && contribution.minimumAmount) {
      if (contributionAmount < Number(contribution.minimumAmount)) {
        res.status(400).json({
          success: false,
          message: `Minimum contribution is ${contribution.minimumAmount} RWF`,
        });
        return;
      }
    }

    const payer = await models.User.findByPk(userId);
    if (!payer) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (!payer.transactionPin) {
      res.status(400).json({
        success: false,
        message: "You have not set up a transaction PIN",
      });
      return;
    }

    // PIN lockout check before opening DB transaction
    if (payer.pinLockedUntil && new Date(payer.pinLockedUntil) > new Date()) {
      const remainingTime = Math.ceil(
        (new Date(payer.pinLockedUntil).getTime() - Date.now()) / 60000
      );
      res.status(429).json({
        success: false,
        message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: payer.pinLockedUntil,
        remainingMinutes: remainingTime,
      });
      return;
    }

    const dbTransaction = await models.sequelize.transaction();

    try {
      const isValidPin = await bcrypt.compare(
        String(pin),
        payer.transactionPin
      );

      if (!isValidPin) {
        const newAttempts = (payer.pinAttempts || 0) + 1;
        const maxAttempts = 5;

        if (newAttempts >= maxAttempts) {
          const lockedUntil = new Date(Date.now() + 15 * 60000);
          await payer.update(
            { pinAttempts: newAttempts, pinLockedUntil: lockedUntil },
            { transaction: dbTransaction }
          );
          await dbTransaction.rollback();
          res.status(429).json({
            success: false,
            message:
              "Too many incorrect PIN attempts. Your PIN has been locked for 15 minutes.",
            lockedUntil,
            remainingMinutes: 15,
          });
        } else {
          await payer.update(
            { pinAttempts: newAttempts },
            { transaction: dbTransaction }
          );
          await dbTransaction.rollback();
          res.status(400).json({
            success: false,
            message: `Incorrect PIN. ${maxAttempts - newAttempts} attempt(s) remaining.`,
            attemptsRemaining: maxAttempts - newAttempts,
          });
        }
        return;
      }

      await payer.update(
        { pinAttempts: 0, pinLockedUntil: null },
        { transaction: dbTransaction }
      );

      // Lock and fetch member wallet
      const memberWallet = await models.Wallet.findOne({
        where: { userId },
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction,
      });

      if (!memberWallet) {
        await dbTransaction.rollback();
        res
          .status(404)
          .json({ success: false, message: "Your wallet was not found" });
        return;
      }

      if (!memberWallet.isActive) {
        await dbTransaction.rollback();
        res
          .status(400)
          .json({ success: false, message: "Your wallet is not active" });
        return;
      }

      const memberBalance = parseFloat(memberWallet.balance.toString());
      if (memberBalance < contributionAmount) {
        await dbTransaction.rollback();
        res
          .status(400)
          .json({ success: false, message: "Insufficient balance" });
        return;
      }

      // Lock and fetch group wallet
      const group = await models.Group.findByPk(groupId, {
        transaction: dbTransaction,
      });

      if (!group) {
        await dbTransaction.rollback();
        res.status(404).json({ success: false, message: "Group not found" });
        return;
      }

      // Auto-create wallet if the group doesn't have one yet
      if (!group.walletId) {
        const newWallet = await models.Wallet.create(
          { groupId: group.id, balance: 0 },
          { transaction: dbTransaction }
        );
        await group.update({ walletId: newWallet.id }, { transaction: dbTransaction });
        group.walletId = newWallet.id;
      }

      const groupWallet = await models.Wallet.findOne({
        where: { id: group.walletId },
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction,
      });

      if (!groupWallet) {
        await dbTransaction.rollback();
        res
          .status(404)
          .json({ success: false, message: "Group wallet not found" });
        return;
      }

      // Debit member wallet
      await memberWallet.update(
        { balance: memberBalance - contributionAmount },
        { transaction: dbTransaction }
      );

      // Credit group wallet
      const groupBalance = parseFloat(groupWallet.balance.toString());
      await groupWallet.update(
        { balance: groupBalance + contributionAmount },
        { transaction: dbTransaction }
      );

      // Create Transaction record (audit trail)
      const txRecord = await models.Transaction.create(
        {
          referenceId: uuidv4(),
          senderWalletId: memberWallet.id,
          receiverWalletId: groupWallet.id,
          amount: contributionAmount,
          totalAmount: contributionAmount,
          currency: "RWF",
          status: "completed",
          type: "transfer",
          description: `Group contribution: ${contribution.title}`,
        },
        { transaction: dbTransaction }
      );

      await models.GroupContributionPayment.create(
        {
          contributionId,
          payerId: userId,
          amount: contributionAmount,
          transactionId: txRecord.id,
        },
        { transaction: dbTransaction }
      );

      const newCollected =
        parseFloat(contribution.collectedAmount.toString()) + contributionAmount;
      const priorPayments = await models.GroupContributionPayment.count({
        where: { contributionId, payerId: userId },
        transaction: dbTransaction,
      });
      // Only increment unique contributor count on first payment from this user.
      // priorPayments already includes the payment just created above.
      const newCount = priorPayments === 1
        ? (contribution.contributorCount || 0) + 1
        : (contribution.contributorCount || 0);
      const isGoalReached =
        contribution.goalAmount != null &&
        newCollected >= parseFloat(contribution.goalAmount.toString());

      await contribution.update(
        {
          collectedAmount: newCollected,
          contributorCount: newCount,
          ...(isGoalReached ? { status: "completed" } : {}),
        },
        { transaction: dbTransaction }
      );

      await dbTransaction.commit();

      await memberWallet.reload();
      await contribution.reload();

      // Real-time + notifications (fire-and-forget after commit)
      const allMembers = await models.GroupMember.findAll({
        where: { groupId, status: GroupMemberStatus.ACTIVE },
        attributes: ["userId", "role"],
      });

      const io = req.app.get("io");

      if (isGoalReached && contribution.disbursementPolicy === "auto") {
        disburseFunds(models, contribution, io).catch((err) =>
          console.error("disburseFunds error on goal reached:", err)
        );
      }
      const progressPayload = {
        groupId,
        contributionId,
        collectedAmount: contribution.collectedAmount,
        goalAmount: contribution.goalAmount,
        contributorCount: contribution.contributorCount,
        status: contribution.status,
        payerId: userId,
        payerName: `${payer.firstName} ${payer.lastName}`,
        amount: contributionAmount,
      };

      if (io) {
        allMembers.forEach((m) => {
          io.to(`user_${m.userId}`).emit("group_contribution_updated", progressPayload);
        });

        if (isGoalReached) {
          allMembers.forEach((m) => {
            io.to(`user_${m.userId}`).emit("group_contribution_completed", {
              groupId,
              contributionId,
              title: contribution.title,
              goalAmount: contribution.goalAmount,
              collectedAmount: contribution.collectedAmount,
            });
          });
        }
      }

      const payerName = `${payer.firstName} ${payer.lastName}`;

      const adminNotifications = allMembers
        .filter(
          (m) =>
            m.userId !== userId &&
            [GroupMemberRole.OWNER, GroupMemberRole.ADMIN].includes(
              m.role as GroupMemberRole
            )
        )
        .map((m) =>
          createAndSendNotification(req.app, {
            type: NotificationType.GROUP_CONTRIBUTION_RECEIVED,
            recipientId: m.userId,
            data: {
              groupId,
              contributionId,
              contributionTitle: contribution.title,
              userId,
              userName: payerName,
              amount: contributionAmount,
              message: `${payerName} contributed ${contributionAmount} RWF to "${contribution.title}"`,
            },
          })
        );

      const completionNotifications = isGoalReached
        ? allMembers.map((m) =>
            createAndSendNotification(req.app, {
              type: NotificationType.GROUP_CONTRIBUTION_COMPLETED,
              recipientId: m.userId,
              data: {
                groupId,
                contributionId,
                contributionTitle: contribution.title,
                amount: contribution.goalAmount != null ? Number(contribution.goalAmount) : undefined,
                message: `The contribution goal for "${contribution.title}" has been reached!`,
              },
            })
          )
        : [];

      await Promise.all([...adminNotifications, ...completionNotifications]);

      res.status(200).json({
        success: true,
        message: "Contribution successful",
        data: {
          amount: contributionAmount,
          newBalance: parseFloat(memberWallet.balance.toString()),
          contribution: {
            id: contribution.id,
            collectedAmount: contribution.collectedAmount,
            goalAmount: contribution.goalAmount,
            status: contribution.status,
          },
        },
      });
    } catch (innerError) {
      await dbTransaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("contribute error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── closeContribution ───────────────────────────────────────────────────────

export const closeContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const adminMembership = await isGroupAdmin(models, groupId, userId);
    if (!adminMembership) {
      res.status(403).json({
        success: false,
        message: "Only group admins can close contribution requests",
      });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });

    if (!contribution) {
      res
        .status(404)
        .json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.status !== "active") {
      res.status(400).json({
        success: false,
        message: `Cannot close a contribution that is already ${contribution.status}`,
      });
      return;
    }

    await contribution.update({ status: "closed" });

    const allMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        userId: { [Op.ne]: userId },
      },
      attributes: ["userId"],
    });

    const io = req.app.get("io");

    if (contribution.disbursementPolicy === "auto") {
      disburseFunds(models, contribution, io).catch((err) =>
        console.error("disburseFunds error on close:", err)
      );
    }

    if (io) {
      allMembers.forEach((m) => {
        io.to(`user_${m.userId}`).emit("group_contribution_closed", {
          groupId,
          contributionId,
          status: "closed",
        });
      });
    }

    await Promise.all(
      allMembers.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.GROUP_CONTRIBUTION_CLOSED,
          recipientId: m.userId,
          data: {
            groupId,
            contributionId,
            contributionTitle: contribution.title,
            message: `The contribution "${contribution.title}" has been closed`,
          },
        })
      )
    );

    res.status(200).json({
      success: true,
      message: "Contribution request closed successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("closeContribution error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── extendDeadline ──────────────────────────────────────────────────────────

export const extendDeadline = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;
    const { deadline } = req.body;

    if (!deadline) {
      res
        .status(400)
        .json({ success: false, message: "New deadline is required" });
      return;
    }

    const newDeadline = new Date(deadline);
    if (isNaN(newDeadline.getTime()) || newDeadline <= new Date()) {
      res.status(400).json({
        success: false,
        message: "deadline must be a valid date in the future",
      });
      return;
    }

    const adminMembership = await isGroupAdmin(models, groupId, userId);
    if (!adminMembership) {
      res.status(403).json({
        success: false,
        message: "Only group admins can extend deadlines",
      });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });

    if (!contribution) {
      res
        .status(404)
        .json({ success: false, message: "Contribution not found" });
      return;
    }

    if (
      contribution.status === "closed" ||
      contribution.status === "completed"
    ) {
      res.status(400).json({
        success: false,
        message: `Cannot extend a contribution that is ${contribution.status}`,
      });
      return;
    }

    const wasExpired = contribution.status === "expired";
    await contribution.update({
      deadline: newDeadline,
      ...(wasExpired ? { status: "active" } : {}),
    });

    const allMembers = await models.GroupMember.findAll({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        userId: { [Op.ne]: userId },
      },
      attributes: ["userId"],
    });

    const io = req.app.get("io");
    if (io) {
      allMembers.forEach((m) => {
        io.to(`user_${m.userId}`).emit("group_contribution_updated", {
          groupId,
          contributionId,
          deadline: newDeadline,
          status: wasExpired ? "active" : contribution.status,
        });
      });
    }

    await Promise.all(
      allMembers.map((m) =>
        createAndSendNotification(req.app, {
          type: NotificationType.GROUP_CONTRIBUTION_UPDATED,
          recipientId: m.userId,
          data: {
            groupId,
            contributionId,
            contributionTitle: contribution.title,
            message: wasExpired
              ? `The contribution "${contribution.title}" has been reactivated with a new deadline`
              : `The deadline for "${contribution.title}" has been extended`,
          },
        })
      )
    );

    res.status(200).json({
      success: true,
      message: wasExpired
        ? "Deadline extended and contribution reactivated"
        : "Deadline extended successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("extendDeadline error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── listContributions ───────────────────────────────────────────────────────

export const listContributions = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const userId = req.user.id;

    const membership = await isActiveMember(models, groupId, userId);
    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You are not an active member of this group",
      });
      return;
    }

    const memberIsAdmin = [
      GroupMemberRole.OWNER,
      GroupMemberRole.ADMIN,
    ].includes(membership.role as GroupMemberRole);

    const contributions = await models.GroupContribution.findAll({
      where: { groupId },
      include: [
        { model: models.User, as: "creator", attributes: ["id", "firstName", "lastName"] },
        { model: models.User, as: "disbursementRecipient", attributes: ["id", "firstName", "lastName"], required: false },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Auto-expire campaigns past their deadline
    const now = new Date();
    await Promise.all(
      contributions
        .filter(
          (c) =>
            c.status === "active" &&
            c.deadline &&
            new Date(c.deadline) < now
        )
        .map((c) => c.update({ status: "expired" }))
    );

    const contributionIds = contributions.map((c) => c.id);

    const allPayments = contributionIds.length
      ? await models.GroupContributionPayment.findAll({
          where: { contributionId: { [Op.in]: contributionIds } },
          include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
          order: [["createdAt", "ASC"]],
        })
      : [];

    const paymentsByContribution = new Map<string, typeof allPayments>();
    for (const p of allPayments) {
      const list = paymentsByContribution.get(p.contributionId) ?? [];
      list.push(p);
      paymentsByContribution.set(p.contributionId, list);
    }

    const result = contributions.map((c) => {
      const plain = c.toJSON() as unknown as Record<string, unknown>;
      const payments = paymentsByContribution.get(c.id) ?? [];
      if (memberIsAdmin || c.visibilityMode === "all") {
        plain.payments = payments;
      }
      plain.myPayment = payments.find((p: any) => p.payerId === userId) ?? null;
      return plain;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("listContributions error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── getContribution ─────────────────────────────────────────────────────────

export const getContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const membership = await isActiveMember(models, groupId, userId);
    if (!membership) {
      res.status(403).json({
        success: false,
        message: "You are not an active member of this group",
      });
      return;
    }

    const memberIsAdmin = [
      GroupMemberRole.OWNER,
      GroupMemberRole.ADMIN,
    ].includes(membership.role as GroupMemberRole);

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
      include: [
        { model: models.User, as: "creator", attributes: ["id", "firstName", "lastName"] },
        { model: models.User, as: "disbursementRecipient", attributes: ["id", "firstName", "lastName"], required: false },
        {
          model: models.GroupContributionPayment,
          as: "payments",
          include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
        },
      ],
    });

    if (!contribution) {
      res
        .status(404)
        .json({ success: false, message: "Contribution not found" });
      return;
    }

    // Auto-expire if deadline passed
    if (
      contribution.status === "active" &&
      contribution.deadline &&
      new Date(contribution.deadline) < new Date()
    ) {
      await contribution.update({ status: "expired" });
    }

    const plain = contribution.toJSON() as unknown as Record<string, unknown>;

    const myPayment = await models.GroupContributionPayment.findOne({
      where: { contributionId, payerId: userId },
      include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
    });

    if (!memberIsAdmin && contribution.visibilityMode === "admin_only") {
      plain.payments = myPayment ? [myPayment] : [];
    }

    plain.myPayment = myPayment;

    res.status(200).json({ success: true, data: plain });
  } catch (error) {
    console.error("getContribution error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── updateContribution ──────────────────────────────────────────────────────

export const updateContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const adminMembership = await isGroupAdmin(models, groupId, userId);
    if (!adminMembership) {
      res.status(403).json({ success: false, message: "Only group admins can edit contributions" });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.status === "closed" || contribution.status === "completed") {
      res.status(400).json({
        success: false,
        message: `Cannot edit a contribution that is ${contribution.status}`,
      });
      return;
    }

    const { title, note, goalAmount, visibilityMode, disbursementPolicy, disbursementRecipientId } = req.body;
    const updates: Record<string, any> = {};

    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ success: false, message: "title cannot be empty" });
        return;
      }
      updates.title = String(title).trim();
    }

    if (note !== undefined) updates.note = note ? String(note).trim() : null;

    if (goalAmount !== undefined) {
      if (goalAmount !== null && Number(goalAmount) <= 0) {
        res.status(400).json({ success: false, message: "goalAmount must be greater than 0" });
        return;
      }
      updates.goalAmount = goalAmount !== null ? Number(goalAmount) : null;
    }

    if (visibilityMode !== undefined) {
      updates.visibilityMode = visibilityMode === "admin_only" ? "admin_only" : "all";
    }

    if (disbursementPolicy !== undefined || disbursementRecipientId !== undefined) {
      const resolvedPolicy = disbursementPolicy !== undefined
        ? (disbursementPolicy === "auto" ? "auto" : "hold")
        : contribution.disbursementPolicy;

      if (resolvedPolicy === "auto") {
        const recipientId = disbursementRecipientId ?? contribution.disbursementRecipientId;
        if (!recipientId) {
          res.status(400).json({
            success: false,
            message: "disbursementRecipientId is required when policy is auto",
          });
          return;
        }
        const recipientMembership = await models.GroupMember.findOne({
          where: {
            groupId,
            userId: recipientId,
            status: GroupMemberStatus.ACTIVE,
            role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
          },
        });
        if (!recipientMembership) {
          res.status(400).json({
            success: false,
            message: "Disbursement recipient must be an active admin or owner",
          });
          return;
        }
        updates.disbursementPolicy = "auto";
        updates.disbursementRecipientId = recipientId;
      } else {
        updates.disbursementPolicy = "hold";
        if (disbursementPolicy === "hold") updates.disbursementRecipientId = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }

    await contribution.update(updates);

    const allMembers = await models.GroupMember.findAll({
      where: { groupId, status: GroupMemberStatus.ACTIVE, userId: { [Op.ne]: userId } },
      attributes: ["userId"],
    });

    const io = req.app.get("io");
    if (io) {
      allMembers.forEach((member) => {
        io.to(`user_${member.userId}`).emit("group_contribution_updated", {
          groupId,
          contributionId: contribution.id,
          ...updates,
        });
      });
    }

    res.status(200).json({
      success: true,
      message: "Contribution updated successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("updateContribution error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── listContributors ────────────────────────────────────────────────────────

export const listContributors = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const membership = await isActiveMember(models, groupId, userId);
    if (!membership) {
      res.status(403).json({ success: false, message: "You are not an active member of this group" });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    const memberIsAdmin = [GroupMemberRole.OWNER, GroupMemberRole.ADMIN].includes(
      membership.role as GroupMemberRole
    );

    if (!memberIsAdmin && contribution.visibilityMode === "admin_only") {
      const myPayment = await models.GroupContributionPayment.findOne({
        where: { contributionId, payerId: userId },
        include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
      });
      res.status(200).json({ success: true, data: myPayment ? [myPayment] : [] });
      return;
    }

    const payments = await models.GroupContributionPayment.findAll({
      where: { contributionId },
      include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    console.error("listContributors error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── withdrawFunds ───────────────────────────────────────────────────────────

export const withdrawFunds = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const adminMembership = await isGroupAdmin(models, groupId, userId);
    if (!adminMembership) {
      res.status(403).json({ success: false, message: "Only group admins can withdraw funds" });
      return;
    }

    const contribution = await models.GroupContribution.findOne({
      where: { id: contributionId, groupId },
    });
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.disbursementPolicy === "auto") {
      res.status(400).json({
        success: false,
        message: "This contribution uses auto-disbursement. Funds are transferred automatically.",
      });
      return;
    }

    const collectedAmount = parseFloat(contribution.collectedAmount.toString());
    if (collectedAmount <= 0) {
      res.status(400).json({ success: false, message: "No funds have been collected yet" });
      return;
    }

    const group = await models.Group.findByPk(groupId);
    if (!group || !group.walletId) {
      res.status(400).json({ success: false, message: "Group wallet not found" });
      return;
    }

    const groupWallet = await models.Wallet.findByPk(group.walletId);
    if (!groupWallet) {
      res.status(404).json({ success: false, message: "Group wallet not found" });
      return;
    }

    const groupBalance = parseFloat(groupWallet.balance.toString());
    const toWithdraw = Math.min(collectedAmount, groupBalance);
    if (toWithdraw <= 0) {
      res.status(400).json({ success: false, message: "No funds available to withdraw" });
      return;
    }

    const recipientWallet = await models.Wallet.findOne({ where: { userId } });
    if (!recipientWallet || !recipientWallet.isActive) {
      res.status(400).json({ success: false, message: "Your wallet is not available" });
      return;
    }

    const dbTransaction = await models.sequelize.transaction();
    try {
      await groupWallet.update({ balance: groupBalance - toWithdraw }, { transaction: dbTransaction });
      const recipientBalance = parseFloat(recipientWallet.balance.toString());
      await recipientWallet.update(
        { balance: recipientBalance + toWithdraw },
        { transaction: dbTransaction }
      );

      await models.Transaction.create(
        {
          referenceId: uuidv4(),
          senderWalletId: groupWallet.id,
          receiverWalletId: recipientWallet.id,
          amount: toWithdraw,
          totalAmount: toWithdraw,
          currency: "RWF",
          status: "completed",
          type: "transfer",
          description: `Contribution withdrawal: ${contribution.title}`,
        },
        { transaction: dbTransaction }
      );

      await dbTransaction.commit();

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userId}`).emit("group_contribution_withdrawn", {
          groupId,
          contributionId,
          amount: toWithdraw,
        });
      }

      res.status(200).json({
        success: true,
        message: `${toWithdraw} RWF withdrawn to your wallet`,
        data: { withdrawn: toWithdraw },
      });
    } catch (innerError) {
      await dbTransaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("withdrawFunds error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── listMyContributions ─────────────────────────────────────────────────────

export const listMyContributions = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const memberships = await models.GroupMember.findAll({
      where: { userId, status: GroupMemberStatus.ACTIVE },
      include: [{ model: models.Group, as: "group", attributes: ["id", "name"] }],
    });

    if (!memberships.length) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const groupIds = memberships.map((m) => m.groupId);
    const groupMap = new Map(memberships.map((m: any) => [m.groupId, m.group?.name ?? "Unknown Group"]));
    const adminGroupIds = new Set(
      memberships
        .filter((m) => [GroupMemberRole.OWNER, GroupMemberRole.ADMIN].includes(m.role as GroupMemberRole))
        .map((m) => m.groupId)
    );

    const contributions = await models.GroupContribution.findAll({
      where: { groupId: { [Op.in]: groupIds } },
      include: [{ model: models.User, as: "creator", attributes: ["id", "firstName", "lastName"] }],
      order: [["createdAt", "DESC"]],
    });

    const now = new Date();
    await Promise.all(
      contributions
        .filter((c) => c.status === "active" && c.deadline && new Date(c.deadline) < now)
        .map((c) => c.update({ status: "expired" }))
    );

    if (!contributions.length) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const contributionIds = contributions.map((c) => c.id);
    const allPayments = await models.GroupContributionPayment.findAll({
      where: { contributionId: { [Op.in]: contributionIds } },
      include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
      order: [["createdAt", "ASC"]],
    });

    const paymentsByContribution = new Map<string, any[]>();
    for (const p of allPayments) {
      const list = paymentsByContribution.get(p.contributionId) ?? [];
      list.push(p);
      paymentsByContribution.set(p.contributionId, list);
    }

    const result = contributions.map((c) => {
      const plain = c.toJSON() as unknown as Record<string, unknown>;
      const isAdmin = adminGroupIds.has(c.groupId);
      const payments = paymentsByContribution.get(c.id) ?? [];

      plain.groupName = groupMap.get(c.groupId) ?? "Unknown Group";
      plain.isAdmin = isAdmin;
      if (isAdmin || c.visibilityMode === "all") {
        plain.payments = payments;
      }
      plain.myPayment = payments.find((p: any) => p.payerId === userId) ?? null;
      return plain;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("listMyContributions error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
