import { Response } from "express";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification } from "../utils/notificationService";
import { GroupMemberRole, GroupMemberStatus, GroupPrivacyType, GroupExpirationType } from "../types/group";

// ─── helpers ────────────────────────────────────────────────────────────────

const getModels = (req: AuthenticatedRequest) =>
  req.app.get("models") as ReturnType<typeof Models>;

// Ensure the campaign has a dedicated wallet; create one on-demand if missing.
const ensureCampaignWallet = async (
  models: ReturnType<typeof Models>,
  contribution: InstanceType<ReturnType<typeof Models>["PublicContribution"]>,
  dbTx?: any
) => {
  if (contribution.walletId) {
    return models.Wallet.findByPk(contribution.walletId, dbTx ? { transaction: dbTx } : undefined);
  }
  const wallet = await models.Wallet.create(
    { publicContributionId: contribution.id, balance: 0 },
    dbTx ? { transaction: dbTx } : undefined
  );
  await contribution.update({ walletId: wallet.id }, dbTx ? { transaction: dbTx } : undefined);
  contribution.walletId = wallet.id;
  return wallet;
};

// Auto-disburse campaign wallet → creator personal wallet (policy = "auto").
const disburseFunds = async (
  models: ReturnType<typeof Models>,
  contribution: InstanceType<ReturnType<typeof Models>["PublicContribution"]>,
  io?: any
) => {
  if (contribution.disbursementPolicy !== "auto") return;

  const collectedAmount = parseFloat(contribution.collectedAmount.toString());
  if (collectedAmount <= 0) return;

  const campaignWallet = await models.Wallet.findByPk(contribution.walletId ?? "");
  const creatorWallet = await models.Wallet.findOne({ where: { userId: contribution.createdBy } });

  if (!campaignWallet || !creatorWallet || !creatorWallet.isActive) {
    console.warn(`disburseFunds: wallet missing for contribution ${contribution.id}`);
    return;
  }

  const campaignBalance = parseFloat(campaignWallet.balance.toString());
  if (campaignBalance < collectedAmount) {
    console.warn(`disburseFunds: campaign balance (${campaignBalance}) < collectedAmount (${collectedAmount})`);
    return;
  }

  const dbTx = await models.sequelize.transaction();
  try {
    await campaignWallet.update({ balance: campaignBalance - collectedAmount }, { transaction: dbTx });
    const creatorBalance = parseFloat(creatorWallet.balance.toString());
    await creatorWallet.update({ balance: creatorBalance + collectedAmount }, { transaction: dbTx });

    await models.Transaction.create(
      {
        referenceId: uuidv4(),
        senderWalletId: campaignWallet.id,
        receiverWalletId: creatorWallet.id,
        amount: collectedAmount,
        totalAmount: collectedAmount,
        currency: "RWF",
        status: "completed",
        type: "transfer",
        description: `Contribution campaign disbursement: ${contribution.title}`,
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    if (io) {
      io.to(`user_${contribution.createdBy}`).emit("public_contribution_disbursed", {
        contributionId: contribution.id,
        amount: collectedAmount,
      });
    }
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
};

// ─── createContribution ─────────────────────────────────────────────────────

export const createContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

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
    } = req.body;

    if (!title || !type) {
      res.status(400).json({ success: false, message: "title and type are required" });
      return;
    }

    if (type !== "fixed" && type !== "flexible") {
      res.status(400).json({ success: false, message: "type must be 'fixed' or 'flexible'" });
      return;
    }

    if (goalAmount != null && Number(goalAmount) <= 0) {
      res.status(400).json({ success: false, message: "goalAmount must be greater than 0" });
      return;
    }

    if (type === "fixed" && (!amountPerMember || Number(amountPerMember) <= 0)) {
      res.status(400).json({
        success: false,
        message: "A positive amountPerMember is required for fixed contributions",
      });
      return;
    }

    if (type === "flexible" && minimumAmount && Number(minimumAmount) <= 0) {
      res.status(400).json({ success: false, message: "minimumAmount must be greater than 0" });
      return;
    }

    if (deadline && new Date(deadline) <= new Date()) {
      res.status(400).json({ success: false, message: "deadline must be in the future" });
      return;
    }

    const contribution = await models.PublicContribution.create({
      createdBy: userId,
      title: String(title).trim(),
      note: note ? String(note).trim() : null,
      goalAmount: goalAmount != null ? Number(goalAmount) : null,
      type,
      amountPerMember: type === "fixed" ? Number(amountPerMember) : null,
      minimumAmount: type === "flexible" && minimumAmount ? Number(minimumAmount) : null,
      deadline: deadline ? new Date(deadline) : null,
      visibilityMode: visibilityMode === "creator_only" ? "creator_only" : "all",
      disbursementPolicy: disbursementPolicy === "auto" ? "auto" : "hold",
    });

    // Create the campaign wallet immediately so the walletId is available in the response
    await ensureCampaignWallet(models, contribution);

    await contribution.reload();

    res.status(201).json({
      success: true,
      message: "Contribution campaign created successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("createContribution error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── contribute (anyone pays into the campaign) ──────────────────────────────

export const contribute = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;
    const { amount, pin } = req.body;

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      res.status(400).json({ success: false, message: "A valid 4-digit PIN is required" });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, message: "A valid amount is required" });
      return;
    }

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    // Auto-expire if deadline passed
    if (
      contribution.status === "active" &&
      contribution.deadline &&
      new Date(contribution.deadline) < new Date()
    ) {
      await contribution.update({ status: "expired" });
      res.status(400).json({ success: false, message: "This contribution campaign has expired" });
      return;
    }

    if (contribution.status !== "active") {
      res.status(400).json({
        success: false,
        message: `This campaign is ${contribution.status} and no longer accepting payments`,
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
      res.status(400).json({ success: false, message: "You have not set up a transaction PIN" });
      return;
    }

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
      const isValidPin = await bcrypt.compare(String(pin), payer.transactionPin);

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
            message: "Too many incorrect PIN attempts. Your PIN has been locked for 15 minutes.",
            lockedUntil,
            remainingMinutes: 15,
          });
        } else {
          await payer.update({ pinAttempts: newAttempts }, { transaction: dbTransaction });
          await dbTransaction.rollback();
          res.status(400).json({
            success: false,
            message: `Incorrect PIN. ${maxAttempts - newAttempts} attempt(s) remaining.`,
            attemptsRemaining: maxAttempts - newAttempts,
          });
        }
        return;
      }

      await payer.update({ pinAttempts: 0, pinLockedUntil: null }, { transaction: dbTransaction });

      // Lock payer wallet
      const payerWallet = await models.Wallet.findOne({
        where: { userId },
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction,
      });

      if (!payerWallet) {
        await dbTransaction.rollback();
        res.status(404).json({ success: false, message: "Your wallet was not found" });
        return;
      }

      if (!payerWallet.isActive) {
        await dbTransaction.rollback();
        res.status(400).json({ success: false, message: "Your wallet is not active" });
        return;
      }

      const payerBalance = parseFloat(payerWallet.balance.toString());
      if (payerBalance < contributionAmount) {
        await dbTransaction.rollback();
        res.status(400).json({ success: false, message: "Insufficient balance" });
        return;
      }

      // Ensure campaign wallet exists (may be first contribution)
      const campaignWallet = await ensureCampaignWallet(models, contribution, dbTransaction);
      if (!campaignWallet) {
        await dbTransaction.rollback();
        res.status(500).json({ success: false, message: "Campaign wallet could not be created" });
        return;
      }

      // Lock campaign wallet
      const lockedCampaignWallet = await models.Wallet.findOne({
        where: { id: campaignWallet.id },
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction,
      });

      if (!lockedCampaignWallet) {
        await dbTransaction.rollback();
        res.status(404).json({ success: false, message: "Campaign wallet not found" });
        return;
      }

      // Debit payer
      await payerWallet.update(
        { balance: payerBalance - contributionAmount },
        { transaction: dbTransaction }
      );

      // Credit campaign wallet
      const campaignBalance = parseFloat(lockedCampaignWallet.balance.toString());
      await lockedCampaignWallet.update(
        { balance: campaignBalance + contributionAmount },
        { transaction: dbTransaction }
      );

      // Audit transaction
      const txRecord = await models.Transaction.create(
        {
          referenceId: uuidv4(),
          senderWalletId: payerWallet.id,
          receiverWalletId: lockedCampaignWallet.id,
          amount: contributionAmount,
          totalAmount: contributionAmount,
          currency: "RWF",
          status: "completed",
          type: "transfer",
          description: `Public contribution: ${contribution.title}`,
        },
        { transaction: dbTransaction }
      );

      await models.PublicContributionPayment.create(
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
      const priorPayments = await models.PublicContributionPayment.count({
        where: { contributionId, payerId: userId },
        transaction: dbTransaction,
      });
      const newCount =
        priorPayments === 1
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

      await payerWallet.reload();
      await contribution.reload();

      const io = req.app.get("io");

      if (isGoalReached && contribution.disbursementPolicy === "auto") {
        disburseFunds(models, contribution, io).catch((err) =>
          console.error("disburseFunds error on goal reached:", err)
        );
      }

      const payerName = `${payer.firstName} ${payer.lastName}`;

      const progressPayload = {
        contributionId,
        collectedAmount: contribution.collectedAmount,
        goalAmount: contribution.goalAmount,
        contributorCount: contribution.contributorCount,
        status: contribution.status,
        payerId: userId,
        payerName,
        amount: contributionAmount,
      };

      if (io) {
        // Notify contributor
        io.to(`user_${userId}`).emit("public_contribution_updated", progressPayload);
        // Notify creator
        io.to(`user_${contribution.createdBy}`).emit("public_contribution_updated", progressPayload);

        if (isGoalReached) {
          io.to(`user_${contribution.createdBy}`).emit("public_contribution_completed", {
            contributionId,
            title: contribution.title,
            goalAmount: contribution.goalAmount,
            collectedAmount: contribution.collectedAmount,
          });
        }
      }

      // Notify creator
      const notifPromises = [
        createAndSendNotification(req.app, {
          type: NotificationType.PUBLIC_CONTRIBUTION_RECEIVED,
          recipientId: contribution.createdBy,
          data: {
            contributionId,
            contributionTitle: contribution.title,
            userId,
            userName: payerName,
            amount: contributionAmount,
            message: `${payerName} contributed ${contributionAmount} RWF to "${contribution.title}"`,
          },
        }),
      ];

      if (isGoalReached) {
        notifPromises.push(
          createAndSendNotification(req.app, {
            type: NotificationType.PUBLIC_CONTRIBUTION_COMPLETED,
            recipientId: contribution.createdBy,
            data: {
              contributionId,
              contributionTitle: contribution.title,
              amount: contribution.goalAmount != null ? Number(contribution.goalAmount) : undefined,
              message: `Your campaign "${contribution.title}" has reached its goal!`,
            },
          })
        );
      }

      await Promise.all(notifPromises);

      const canJoinGroup = !!(contribution.linkedGroupId && contribution.allowContributorJoin);

      res.status(200).json({
        success: true,
        message: "Contribution successful",
        data: {
          amount: contributionAmount,
          newBalance: parseFloat(payerWallet.balance.toString()),
          canJoinGroup,
          linkedGroupId: canJoinGroup ? contribution.linkedGroupId : null,
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
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.createdBy !== userId) {
      res.status(403).json({ success: false, message: "Only the campaign creator can close it" });
      return;
    }

    if (contribution.status !== "active") {
      res.status(400).json({
        success: false,
        message: `Cannot close a campaign that is already ${contribution.status}`,
      });
      return;
    }

    await contribution.update({ status: "closed" });

    const io = req.app.get("io");
    if (contribution.disbursementPolicy === "auto") {
      disburseFunds(models, contribution, io).catch((err) =>
        console.error("disburseFunds error on close:", err)
      );
    }

    if (io) {
      io.to(`user_${userId}`).emit("public_contribution_closed", {
        contributionId,
        status: "closed",
      });
    }

    await createAndSendNotification(req.app, {
      type: NotificationType.PUBLIC_CONTRIBUTION_CLOSED,
      recipientId: userId,
      data: {
        contributionId,
        contributionTitle: contribution.title,
        message: `Your campaign "${contribution.title}" has been closed`,
      },
    });

    res.status(200).json({
      success: true,
      message: "Campaign closed successfully",
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
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;
    const { deadline } = req.body;

    if (!deadline) {
      res.status(400).json({ success: false, message: "New deadline is required" });
      return;
    }

    const newDeadline = new Date(deadline);
    if (isNaN(newDeadline.getTime()) || newDeadline <= new Date()) {
      res.status(400).json({ success: false, message: "deadline must be a valid future date" });
      return;
    }

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.createdBy !== userId) {
      res.status(403).json({ success: false, message: "Only the campaign creator can extend the deadline" });
      return;
    }

    if (contribution.status === "closed" || contribution.status === "completed") {
      res.status(400).json({
        success: false,
        message: `Cannot extend a campaign that is ${contribution.status}`,
      });
      return;
    }

    const wasExpired = contribution.status === "expired";
    await contribution.update({
      deadline: newDeadline,
      ...(wasExpired ? { status: "active" } : {}),
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${userId}`).emit("public_contribution_updated", {
        contributionId,
        deadline: newDeadline,
        status: wasExpired ? "active" : contribution.status,
      });
    }

    res.status(200).json({
      success: true,
      message: wasExpired
        ? "Deadline extended and campaign reactivated"
        : "Deadline extended successfully",
      data: contribution,
    });
  } catch (error) {
    console.error("extendDeadline error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── getContribution (public — any logged-in user) ───────────────────────────

export const getContribution = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user?.id;

    const contribution = await models.PublicContribution.findByPk(contributionId, {
      include: [
        { model: models.User, as: "creator", attributes: ["id", "firstName", "lastName"] },
        {
          model: models.PublicContributionPayment,
          as: "payments",
          include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
        },
      ],
    });

    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    // Auto-expire
    if (
      contribution.status === "active" &&
      contribution.deadline &&
      new Date(contribution.deadline) < new Date()
    ) {
      await contribution.update({ status: "expired" });
    }

    const plain = contribution.toJSON() as unknown as Record<string, unknown>;

    // Restrict payment list to creator if visibilityMode = "creator_only"
    const isCreator = userId === contribution.createdBy;
    if (!isCreator && contribution.visibilityMode === "creator_only") {
      const myPayment = (plain.payments as any[] ?? []).find((p: any) => p.payerId === userId);
      plain.payments = myPayment ? [myPayment] : [];
    }

    if (userId) {
      const myPayment = await models.PublicContributionPayment.findOne({
        where: { contributionId, payerId: userId },
      });
      plain.myPayment = myPayment ?? null;
    }

    plain.isCreator = isCreator;

    res.status(200).json({ success: true, data: plain });
  } catch (error) {
    console.error("getContribution error:", error);
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

    const contributions = await models.PublicContribution.findAll({
      where: { createdBy: userId },
      include: [
        { model: models.User, as: "creator", attributes: ["id", "firstName", "lastName"] },
        {
          model: models.PublicContributionPayment,
          as: "payments",
          include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const now = new Date();
    await Promise.all(
      contributions
        .filter((c) => c.status === "active" && c.deadline && new Date(c.deadline) < now)
        .map((c) => c.update({ status: "expired" }))
    );

    const data = contributions.map((c) => {
      const plain = c.get({ plain: true }) as any;
      plain.isCreator = true;
      return plain;
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("listMyContributions error:", error);
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
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.createdBy !== userId) {
      res.status(403).json({ success: false, message: "Only the campaign creator can edit it" });
      return;
    }

    if (contribution.status === "closed" || contribution.status === "completed") {
      res.status(400).json({
        success: false,
        message: `Cannot edit a campaign that is ${contribution.status}`,
      });
      return;
    }

    const { title, note, goalAmount, visibilityMode, disbursementPolicy, allowContributorJoin } = req.body;
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
      updates.visibilityMode = visibilityMode === "creator_only" ? "creator_only" : "all";
    }

    if (disbursementPolicy !== undefined) {
      updates.disbursementPolicy = disbursementPolicy === "auto" ? "auto" : "hold";
    }

    if (allowContributorJoin !== undefined) {
      updates.allowContributorJoin = Boolean(allowContributorJoin);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }

    await contribution.update(updates);

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${userId}`).emit("public_contribution_updated", {
        contributionId: contribution.id,
        ...updates,
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
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
    const contributionId = req.params.contributionId as string;
    const userId = req.user?.id;

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    const isCreator = userId === contribution.createdBy;

    if (!isCreator && contribution.visibilityMode === "creator_only") {
      const myPayment = userId
        ? await models.PublicContributionPayment.findOne({
            where: { contributionId, payerId: userId },
            include: [{ model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] }],
          })
        : null;
      res.status(200).json({ success: true, data: myPayment ? [myPayment] : [] });
      return;
    }

    const payments = await models.PublicContributionPayment.findAll({
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

// ─── withdrawFunds (creator withdraws from campaign wallet to personal wallet)

export const withdrawFunds = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.createdBy !== userId) {
      res.status(403).json({ success: false, message: "Only the campaign creator can withdraw funds" });
      return;
    }

    if (contribution.disbursementPolicy === "auto") {
      res.status(400).json({
        success: false,
        message: "This campaign uses auto-disbursement. Funds are transferred automatically.",
      });
      return;
    }

    if (!contribution.walletId) {
      res.status(400).json({ success: false, message: "No funds have been collected yet" });
      return;
    }

    const campaignWallet = await models.Wallet.findByPk(contribution.walletId);
    if (!campaignWallet) {
      res.status(404).json({ success: false, message: "Campaign wallet not found" });
      return;
    }

    const available = parseFloat(campaignWallet.balance.toString());
    if (available <= 0) {
      res.status(400).json({ success: false, message: "No funds available to withdraw" });
      return;
    }

    const creatorWallet = await models.Wallet.findOne({ where: { userId } });
    if (!creatorWallet || !creatorWallet.isActive) {
      res.status(400).json({ success: false, message: "Your wallet is not available" });
      return;
    }

    const dbTransaction = await models.sequelize.transaction();
    try {
      await campaignWallet.update({ balance: 0 }, { transaction: dbTransaction });
      const creatorBalance = parseFloat(creatorWallet.balance.toString());
      await creatorWallet.update(
        { balance: creatorBalance + available },
        { transaction: dbTransaction }
      );

      await models.Transaction.create(
        {
          referenceId: uuidv4(),
          senderWalletId: campaignWallet.id,
          receiverWalletId: creatorWallet.id,
          amount: available,
          totalAmount: available,
          currency: "RWF",
          status: "completed",
          type: "transfer",
          description: `Contribution withdrawal: ${contribution.title}`,
        },
        { transaction: dbTransaction }
      );

      await dbTransaction.commit();

      res.status(200).json({
        success: true,
        message: `${available} RWF withdrawn to your wallet`,
        data: { withdrawn: available },
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

// ─── getContributionByGroup ──────────────────────────────────────────────────

export const getContributionByGroup = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const groupId = req.params.groupId as string;

    const contribution = await models.PublicContribution.findOne({
      where: { linkedGroupId: groupId },
      attributes: ["id", "title", "status", "collectedAmount", "goalAmount", "createdBy"],
    });

    if (!contribution) {
      res.status(404).json({ success: false, message: "No campaign linked to this group" });
      return;
    }

    res.status(200).json({ success: true, data: contribution });
  } catch (error) {
    console.error("getContributionByGroup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── createLinkedGroup ───────────────────────────────────────────────────────

export const createLinkedGroup = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const contribution = await models.PublicContribution.findByPk(contributionId);
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (contribution.createdBy !== userId) {
      res.status(403).json({ success: false, message: "Only the campaign creator can create a linked group" });
      return;
    }

    if (contribution.linkedGroupId) {
      res.status(400).json({ success: false, message: "This campaign already has a linked group" });
      return;
    }

    const { name, description, isOpen } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, message: "Group name is required" });
      return;
    }

    const privacyType = isOpen ? GroupPrivacyType.PUBLIC : GroupPrivacyType.REQUIRE_APPROVAL;

    const group = await models.Group.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      ownerId: userId,
      adminId: userId,
      isPrivate: !isOpen,
      privacyType,
      expirationType: GroupExpirationType.NEVER,
      hasFundraising: false,
    });

    await models.GroupMember.create({
      groupId: group.id,
      userId,
      role: GroupMemberRole.OWNER,
      status: GroupMemberStatus.ACTIVE,
      invitedBy: userId,
      joinedAt: new Date(),
      invitedAt: new Date(),
      autoApproved: true,
    });

    await models.Group.increment("memberCount", { where: { id: group.id } });
    await contribution.update({ linkedGroupId: group.id });

    res.status(201).json({
      success: true,
      message: "Community group created and linked to campaign",
      data: {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: 1,
        privacyType: group.privacyType,
        isOpen: privacyType === GroupPrivacyType.PUBLIC,
      },
    });
  } catch (error) {
    console.error("createLinkedGroup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── getLinkedGroup ──────────────────────────────────────────────────────────

export const getLinkedGroup = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user?.id;

    const contribution = await models.PublicContribution.findByPk(contributionId, {
      attributes: ["id", "linkedGroupId", "allowContributorJoin"],
    });
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (!contribution.linkedGroupId) {
      res.status(404).json({ success: false, message: "This campaign has no linked group" });
      return;
    }

    const group = await models.Group.findByPk(contribution.linkedGroupId, {
      attributes: ["id", "name", "description", "memberCount", "privacyType", "profilePictureUrl"],
    });
    if (!group) {
      res.status(404).json({ success: false, message: "Linked group not found" });
      return;
    }

    let isUserMember = false;
    let memberStatus: string | null = null;
    if (userId) {
      const membership = await models.GroupMember.findOne({
        where: { groupId: group.id, userId },
        attributes: ["status", "role"],
      });
      if (membership) {
        isUserMember = membership.status === GroupMemberStatus.ACTIVE;
        memberStatus = membership.status;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.memberCount ?? 0,
        privacyType: group.privacyType,
        isOpen: group.privacyType === GroupPrivacyType.PUBLIC,
        profilePictureUrl: group.profilePictureUrl,
        allowContributorJoin: contribution.allowContributorJoin,
        isUserMember,
        memberStatus,
      },
    });
  } catch (error) {
    console.error("getLinkedGroup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── joinLinkedGroup ─────────────────────────────────────────────────────────

export const joinLinkedGroup = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const models = getModels(req);
    const contributionId = req.params.contributionId as string;
    const userId = req.user.id;

    const contribution = await models.PublicContribution.findByPk(contributionId, {
      attributes: ["id", "linkedGroupId", "allowContributorJoin"],
    });
    if (!contribution) {
      res.status(404).json({ success: false, message: "Contribution not found" });
      return;
    }

    if (!contribution.linkedGroupId) {
      res.status(404).json({ success: false, message: "This campaign has no linked group" });
      return;
    }

    const group = await models.Group.findByPk(contribution.linkedGroupId);
    if (!group) {
      res.status(404).json({ success: false, message: "Linked group not found" });
      return;
    }

    const existing = await models.GroupMember.findOne({
      where: { groupId: group.id, userId },
    });
    if (existing) {
      res.status(400).json({
        success: false,
        message:
          existing.status === GroupMemberStatus.ACTIVE
            ? "You are already a member of this group"
            : "Your join request is pending approval",
      });
      return;
    }

    const isAutoApproved = group.privacyType === GroupPrivacyType.PUBLIC;

    await models.GroupMember.create({
      groupId: group.id,
      userId,
      role: GroupMemberRole.MEMBER,
      status: isAutoApproved ? GroupMemberStatus.ACTIVE : GroupMemberStatus.PENDING,
      invitedBy: userId,
      invitedAt: new Date(),
      joinedAt: isAutoApproved ? new Date() : undefined,
      autoApproved: isAutoApproved,
    });

    if (isAutoApproved) {
      await models.Group.increment("memberCount", { where: { id: group.id } });
    }

    const io = req.app.get("io");
    if (io && isAutoApproved) {
      io.to(`user_${group.ownerId}`).emit("group_member_joined", {
        groupId: group.id,
        userId,
      });
    }

    res.status(200).json({
      success: true,
      message: isAutoApproved
        ? "You have joined the group"
        : "Your join request has been submitted and is pending approval",
      data: { status: isAutoApproved ? GroupMemberStatus.ACTIVE : GroupMemberStatus.PENDING },
    });
  } catch (error) {
    console.error("joinLinkedGroup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
