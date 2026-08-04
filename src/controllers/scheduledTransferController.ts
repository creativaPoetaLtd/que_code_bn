import { Response } from "express";
import { Op } from "sequelize";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { resolveWalletWhere } from "../utils/transferValidation";
import { validateRecurrenceRule, computeNextRun, isRecurrenceExhausted } from "../utils/recurrence";
import {
  placeHoldForOccurrence,
  releaseHoldForOccurrence,
  ROLLING_HOLD_WINDOW_HOURS,
} from "../services/scheduledTransferExecutionService";
import {
  notifyScheduledTransferCreated,
  notifyScheduledTransferCancelled,
  notifyScheduledTransferPaused,
  notifyScheduledTransferResumed,
  notifyScheduledBatchCreated,
} from "../utils/notificationHelpers";

const {
  sequelize,
  Wallet,
  ScheduledTransfer,
  ScheduledTransferBatch,
  Category,
  User,
  Organization,
  Action,
  SubAction,
  Transaction: TransactionModel,
} = database_models as any;

const PARTY_INCLUDES = [
  { model: User, as: "senderUser", attributes: ["id", "firstName", "lastName"] },
  { model: User, as: "receiverUser", attributes: ["id", "firstName", "lastName"] },
  { model: Organization, as: "senderOrganization", attributes: ["id", "name"] },
  { model: Organization, as: "receiverOrganization", attributes: ["id", "name"] },
];

const MIN_LEAD_MINUTES = 5;
const MAX_HORIZON_DAYS = 365;
const MAX_ACTIVE_PER_USER = 50;
const MAX_BATCH_RECIPIENTS = 100;
const EDITABLE_STATUSES = ["scheduled", "held"];
const ACTIVE_STATUSES = ["scheduled", "held", "executing", "paused"];
const CANCELLABLE_STATUSES = ["scheduled", "held", "paused"];

class ControllerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const handleControllerError = (res: Response, error: unknown, context: string): void => {
  if (error instanceof ControllerError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error(`${context} error:`, error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

const verifyPin = async (userId: string, pin: string): Promise<void> => {
  const user = await User.findByPk(userId);
  if (!user) throw new ControllerError(404, "Authenticated user not found");
  if (!user.hasPinSet) {
    throw new ControllerError(403, "PIN not set up. Please set up your transaction PIN first.");
  }
  if (!pin) throw new ControllerError(400, "PIN is required");
  if (!/^\d{4}$/.test(pin)) throw new ControllerError(400, "PIN must be exactly 4 digits");

  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000);
    throw new ControllerError(429, `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`);
  }

  const isValid = await bcrypt.compare(pin, user.transactionPin!);
  if (!isValid) {
    const attempts = (user.pinAttempts || 0) + 1;
    const maxAttempts = 3;
    if (attempts >= maxAttempts) {
      await user.update({ pinAttempts: attempts, pinLockedUntil: new Date(Date.now() + 15 * 60000) });
      throw new ControllerError(429, "Account locked due to too many failed PIN attempts. Please reset your PIN.");
    }
    await user.update({ pinAttempts: attempts });
    throw new ControllerError(400, `Invalid PIN. ${maxAttempts - attempts} attempts remaining.`);
  }

  await user.update({ pinAttempts: 0, pinLockedUntil: null });
};

const validateScheduledFor = (value: unknown): Date => {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) throw new ControllerError(400, "scheduledFor must be a valid date");

  const now = new Date();
  const minAllowed = new Date(now.getTime() + MIN_LEAD_MINUTES * 60000);
  const maxAllowed = new Date(now.getTime() + MAX_HORIZON_DAYS * 24 * 60 * 60000);

  if (date < minAllowed) {
    throw new ControllerError(400, `scheduledFor must be at least ${MIN_LEAD_MINUTES} minutes in the future`);
  }
  if (date > maxAllowed) {
    throw new ControllerError(400, `scheduledFor cannot be more than ${MAX_HORIZON_DAYS} days in the future`);
  }
  return date;
};

/**
 * Schedule a one-time or recurring transfer. Funds for the first occurrence are
 * reserved immediately - creation fails outright if they can't be, rather than
 * silently deferring an insufficient-funds failure to execution time.
 */
const createScheduledTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      senderUserId,
      senderOrganizationId,
      senderSubActionId,
      receiverUserId,
      receiverOrganizationId,
      receiverWalletId,
      amount,
      description = "",
      categoryId,
      type = "transfer",
      applyConstraints = false,
      pin,
      scheduledFor,
      timezone = "Africa/Kigali",
      recurrence,
    } = req.body;

    const senderTargets = [senderUserId, senderOrganizationId, senderSubActionId].filter(Boolean).length;
    const receiverTargets = [receiverUserId, receiverOrganizationId, receiverWalletId].filter(Boolean).length;

    if (senderTargets !== 1 || receiverTargets !== 1 || !amount) {
      throw new ControllerError(
        400,
        "Exactly one sender (user, organization, or sub-action), one receiver (user, organization, or wallet), and amount are required"
      );
    }
    if (parseFloat(amount) <= 0) {
      throw new ControllerError(400, "Amount must be greater than 0");
    }
    if (
      (senderUserId && receiverUserId && senderUserId === receiverUserId) ||
      (senderOrganizationId && receiverOrganizationId && senderOrganizationId === receiverOrganizationId)
    ) {
      throw new ControllerError(400, "Cannot schedule a transfer to yourself");
    }

    const scheduledDate = validateScheduledFor(scheduledFor);

    if (recurrence) {
      const ruleCheck = validateRecurrenceRule(recurrence);
      if (!ruleCheck.valid) throw new ControllerError(400, ruleCheck.error!);
    }

    const authenticatedUserId = req.user.id;
    const authUser = (req as unknown as AuthRequest).user;
    const requesterOrganizationId =
      authUser?.accountType === "organization" ? authUser.id : authUser?.organizationId || null;

    if (senderUserId && senderUserId !== authenticatedUserId) {
      throw new ControllerError(403, "You can only schedule transfers from your own account");
    }
    if (senderOrganizationId) {
      if (!requesterOrganizationId || senderOrganizationId !== requesterOrganizationId) {
        throw new ControllerError(403, "You are not authorized to schedule transfers from this organization");
      }
    }
    if (senderSubActionId) {
      if (!requesterOrganizationId) {
        throw new ControllerError(400, "Organization context is required to schedule from a sub-action wallet");
      }
      const subActionRecord: any = await SubAction.findByPk(senderSubActionId, {
        include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
      });
      if (!subActionRecord) throw new ControllerError(404, "Sender sub-action not found");
      const ownerOrganizationId = subActionRecord.action?.organizationId;
      if (!ownerOrganizationId || ownerOrganizationId !== requesterOrganizationId) {
        throw new ControllerError(403, "You are not authorized to schedule transfers from this sub-action wallet");
      }
    }

    const activeCount = await ScheduledTransfer.count({
      where: { createdByUserId: authenticatedUserId, status: { [Op.in]: ACTIVE_STATUSES } },
    });
    if (activeCount >= MAX_ACTIVE_PER_USER) {
      throw new ControllerError(400, `You can have at most ${MAX_ACTIVE_PER_USER} active scheduled transfers`);
    }

    let pinVerifiedAt: Date | null = null;
    if (senderUserId) {
      await verifyPin(authenticatedUserId, pin);
      pinVerifiedAt = new Date();
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) throw new ControllerError(400, "Invalid category ID");
    }

    const receiverWhere = resolveWalletWhere({
      userId: receiverUserId,
      organizationId: receiverOrganizationId,
      walletId: receiverWalletId,
    });
    const receiverWallet = receiverWhere ? await Wallet.findOne({ where: receiverWhere }) : null;
    if (!receiverWallet) throw new ControllerError(404, "Receiver wallet not found or inactive");

    const id = uuidv4();
    const transferAmount = parseFloat(amount);
    let created: any;

    await sequelize.transaction(async (t: any) => {
      created = await ScheduledTransfer.create(
        {
          id,
          createdByUserId: authenticatedUserId,
          senderUserId: senderUserId || null,
          senderOrganizationId: senderOrganizationId || null,
          senderSubActionId: senderSubActionId || null,
          receiverUserId: receiverUserId || null,
          receiverOrganizationId: receiverOrganizationId || null,
          receiverWalletId: receiverWalletId || null,
          amount: transferAmount,
          fee: 0,
          currency: receiverWallet.currency || "RWF",
          type,
          description,
          categoryId: categoryId || null,
          applyConstraints,
          scheduledFor: scheduledDate,
          timezone,
          recurrenceRule: recurrence || null,
          occurrenceCount: 0,
          status: "scheduled",
          idempotencyKey: `${id}:0`,
          pinVerifiedAt,
        } as any,
        { transaction: t }
      );

      const holdOutcome = await placeHoldForOccurrence(created, t);
      if (!holdOutcome.ok) {
        throw new ControllerError(400, holdOutcome.message || "Insufficient funds to schedule this transfer");
      }

      await created.update(
        { status: "held", heldAmount: holdOutcome.heldAmount, heldAt: new Date() },
        { transaction: t }
      );
    });

    await notifyScheduledTransferCreated(
      req.app,
      authenticatedUserId,
      created.id,
      transferAmount,
      created.currency,
      scheduledDate,
      !!recurrence
    );

    res.status(201).json({ success: true, message: "Transfer scheduled successfully", data: created });
  } catch (error) {
    handleControllerError(res, error, "Create scheduled transfer");
  }
};

/**
 * Schedules a transfer to multiple recipients at once - one PIN entry, one date/recurrence
 * rule, applied to every recipient. Each recipient gets its own ScheduledTransfer row and its
 * own independent hold attempt: a recipient that can't be scheduled (bad wallet, no funds left
 * once earlier recipients in the batch have claimed their holds) is recorded as failed with a
 * reason, and the rest of the batch is still scheduled - same partial-success rule as the
 * immediate multi-recipient send.
 */
const createScheduledBatchTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      senderUserId,
      senderOrganizationId,
      senderSubActionId,
      recipients,
      description = "",
      categoryId,
      type = "transfer",
      applyConstraints = false,
      pin,
      scheduledFor,
      timezone = "Africa/Kigali",
      recurrence,
    } = req.body as {
      senderUserId?: string;
      senderOrganizationId?: string;
      senderSubActionId?: string;
      recipients: Array<{
        receiverUserId?: string;
        receiverOrganizationId?: string;
        receiverWalletId?: string;
        amount: number | string;
        description?: string;
      }>;
      description?: string;
      categoryId?: string;
      type?: string;
      applyConstraints?: boolean;
      pin?: string;
      scheduledFor: string;
      timezone?: string;
      recurrence?: any;
    };

    const senderTargets = [senderUserId, senderOrganizationId, senderSubActionId].filter(Boolean).length;
    if (senderTargets !== 1) {
      throw new ControllerError(400, "Exactly one sender (user, organization, or sub-action) is required");
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new ControllerError(400, "At least one recipient is required");
    }
    if (recipients.length > MAX_BATCH_RECIPIENTS) {
      throw new ControllerError(400, `A scheduled batch can contain at most ${MAX_BATCH_RECIPIENTS} recipients`);
    }
    for (const r of recipients) {
      const targets = [r.receiverUserId, r.receiverOrganizationId, r.receiverWalletId].filter(Boolean).length;
      if (targets !== 1 || !r.amount || parseFloat(r.amount.toString()) <= 0) {
        throw new ControllerError(400, "Each recipient needs exactly one receiver target and an amount greater than 0");
      }
      if (
        (senderUserId && r.receiverUserId && senderUserId === r.receiverUserId) ||
        (senderOrganizationId && r.receiverOrganizationId && senderOrganizationId === r.receiverOrganizationId)
      ) {
        throw new ControllerError(400, "Cannot schedule a transfer to yourself");
      }
    }

    const scheduledDate = validateScheduledFor(scheduledFor);
    if (recurrence) {
      const ruleCheck = validateRecurrenceRule(recurrence);
      if (!ruleCheck.valid) throw new ControllerError(400, ruleCheck.error!);
    }

    const authenticatedUserId = req.user.id;
    const authUser = (req as unknown as AuthRequest).user;
    const requesterOrganizationId =
      authUser?.accountType === "organization" ? authUser.id : authUser?.organizationId || null;

    if (senderUserId && senderUserId !== authenticatedUserId) {
      throw new ControllerError(403, "You can only schedule transfers from your own account");
    }
    if (senderOrganizationId) {
      if (!requesterOrganizationId || senderOrganizationId !== requesterOrganizationId) {
        throw new ControllerError(403, "You are not authorized to schedule transfers from this organization");
      }
    }
    if (senderSubActionId) {
      if (!requesterOrganizationId) {
        throw new ControllerError(400, "Organization context is required to schedule from a sub-action wallet");
      }
      const subActionRecord: any = await SubAction.findByPk(senderSubActionId, {
        include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
      });
      if (!subActionRecord) throw new ControllerError(404, "Sender sub-action not found");
      const ownerOrganizationId = subActionRecord.action?.organizationId;
      if (!ownerOrganizationId || ownerOrganizationId !== requesterOrganizationId) {
        throw new ControllerError(403, "You are not authorized to schedule transfers from this sub-action wallet");
      }
    }

    const activeCount = await ScheduledTransfer.count({
      where: { createdByUserId: authenticatedUserId, status: { [Op.in]: ACTIVE_STATUSES } },
    });
    if (activeCount + recipients.length > MAX_ACTIVE_PER_USER) {
      throw new ControllerError(
        400,
        `This batch would exceed your limit of ${MAX_ACTIVE_PER_USER} active scheduled transfers`
      );
    }

    let pinVerifiedAt: Date | null = null;
    if (senderUserId) {
      await verifyPin(authenticatedUserId, pin as string);
      pinVerifiedAt = new Date();
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) throw new ControllerError(400, "Invalid category ID");
    }

    const totalRequestedAmount = recipients.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
    const batch = await ScheduledTransferBatch.create({
      createdByUserId: authenticatedUserId,
      senderUserId: senderUserId || null,
      senderOrganizationId: senderOrganizationId || null,
      senderSubActionId: senderSubActionId || null,
      type,
      description,
      categoryId: categoryId || null,
      applyConstraints,
      recipientCount: recipients.length,
      totalRequestedAmount,
    } as any);

    const results: any[] = [];
    const failures: any[] = [];
    let successCount = 0;

    for (const recipient of recipients) {
      const recipientIdentity = {
        receiverUserId: recipient.receiverUserId || null,
        receiverOrganizationId: recipient.receiverOrganizationId || null,
        receiverWalletId: recipient.receiverWalletId || null,
      };
      const transferAmount = parseFloat(recipient.amount.toString());

      try {
        const receiverWhere = resolveWalletWhere({
          userId: recipient.receiverUserId,
          organizationId: recipient.receiverOrganizationId,
          walletId: recipient.receiverWalletId,
        });
        const receiverWallet = receiverWhere ? await Wallet.findOne({ where: receiverWhere }) : null;
        if (!receiverWallet) {
          throw new Error("Receiver wallet not found or inactive");
        }

        const id = uuidv4();
        let created: any;

        await sequelize.transaction(async (t: any) => {
          created = await ScheduledTransfer.create(
            {
              id,
              createdByUserId: authenticatedUserId,
              senderUserId: senderUserId || null,
              senderOrganizationId: senderOrganizationId || null,
              senderSubActionId: senderSubActionId || null,
              receiverUserId: recipient.receiverUserId || null,
              receiverOrganizationId: recipient.receiverOrganizationId || null,
              receiverWalletId: recipient.receiverWalletId || null,
              amount: transferAmount,
              fee: 0,
              currency: receiverWallet.currency || "RWF",
              type,
              description: recipient.description || description,
              categoryId: categoryId || null,
              applyConstraints,
              scheduledFor: scheduledDate,
              timezone,
              recurrenceRule: recurrence || null,
              occurrenceCount: 0,
              status: "scheduled",
              idempotencyKey: `${id}:0`,
              pinVerifiedAt,
              scheduledBatchId: batch.id,
            } as any,
            { transaction: t }
          );

          const holdOutcome = await placeHoldForOccurrence(created, t);
          if (!holdOutcome.ok) {
            throw new Error(holdOutcome.message || "Insufficient funds to schedule this transfer");
          }

          await created.update(
            { status: "held", heldAmount: holdOutcome.heldAmount, heldAt: new Date() },
            { transaction: t }
          );
        });

        successCount += 1;
        results.push({
          ...recipientIdentity,
          amount: transferAmount,
          status: "success",
          scheduledTransferId: created.id,
        });
      } catch (err: any) {
        const reason = err?.message || "Failed to schedule this recipient";
        failures.push({ ...recipientIdentity, amount: transferAmount, reason });
        results.push({ ...recipientIdentity, amount: transferAmount, status: "failed", reason });
      }
    }

    const failureCount = recipients.length - successCount;
    const status = successCount === 0 ? "failed" : failureCount > 0 ? "partial" : "completed";

    await batch.update({
      successCount,
      failureCount,
      status,
      failures: failures.length > 0 ? failures : null,
    });

    if (senderUserId) {
      await notifyScheduledBatchCreated(
        req.app,
        senderUserId,
        batch.id,
        successCount,
        failureCount,
        scheduledDate,
        !!recurrence
      );
    }

    res.status(201).json({
      success: true,
      message: `Scheduled ${successCount} of ${recipients.length} transfers`,
      data: {
        batchId: batch.id,
        status,
        scheduledFor: scheduledDate,
        recurrence: recurrence || null,
        recipientCount: recipients.length,
        successCount,
        failureCount,
        totalRequestedAmount,
        results,
      },
    });
  } catch (error) {
    handleControllerError(res, error, "Create scheduled batch transfer");
  }
};

const getScheduledBatchById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const batch = await ScheduledTransferBatch.findByPk(id);
    if (!batch || batch.createdByUserId !== userId) {
      throw new ControllerError(404, "Scheduled batch not found");
    }

    const scheduledTransfers = await ScheduledTransfer.findAll({
      where: { scheduledBatchId: batch.id },
      include: PARTY_INCLUDES,
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        ...batch.toJSON(),
        scheduledTransfers,
        failures: batch.failures || [],
      },
    });
  } catch (error) {
    handleControllerError(res, error, "Get scheduled batch");
  }
};

const listScheduledBatches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { limit = "20", offset = "0" } = req.query as Record<string, string>;

    const { rows, count } = await ScheduledTransferBatch.findAndCountAll({
      where: { createdByUserId: userId },
      order: [["createdAt", "DESC"]],
      limit: Math.min(parseInt(limit) || 20, 100),
      offset: parseInt(offset) || 0,
    });

    res.status(200).json({ success: true, data: rows, total: count });
  } catch (error) {
    handleControllerError(res, error, "List scheduled batches");
  }
};

/**
 * Cancels every still-cancellable child transfer in the group (releasing any holds).
 * Transfers already executed, cancelled, or otherwise past cancellation are left untouched
 * and reported separately, rather than failing the whole request.
 */
const cancelScheduledBatch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const batch = await ScheduledTransferBatch.findByPk(id);
    if (!batch || batch.createdByUserId !== userId) {
      throw new ControllerError(404, "Scheduled batch not found");
    }

    const scheduledTransfers = await ScheduledTransfer.findAll({ where: { scheduledBatchId: batch.id } });

    let cancelledCount = 0;
    const skipped: any[] = [];

    for (const st of scheduledTransfers) {
      if (!CANCELLABLE_STATUSES.includes(st.status)) {
        skipped.push({ scheduledTransferId: st.id, status: st.status });
        continue;
      }
      await sequelize.transaction(async (t: any) => {
        const locked = await ScheduledTransfer.findByPk(st.id, { lock: t.LOCK.UPDATE, transaction: t });
        if (!locked || !CANCELLABLE_STATUSES.includes(locked.status)) return;
        if (locked.status === "held") {
          await releaseHoldForOccurrence(locked, t);
        }
        await locked.update({ status: "cancelled", heldAmount: null, heldAt: null }, { transaction: t });
      });
      cancelledCount += 1;
    }

    res.status(200).json({
      success: true,
      message: `Cancelled ${cancelledCount} of ${scheduledTransfers.length} scheduled transfers in this batch`,
      data: { batchId: batch.id, cancelledCount, skipped },
    });
  } catch (error) {
    handleControllerError(res, error, "Cancel scheduled batch");
  }
};

const listScheduledTransfers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { status, direction = "outgoing", limit = "20", offset = "0" } = req.query as Record<string, string>;

    const where: any = {};
    if (direction === "incoming") {
      where.receiverUserId = userId;
    } else if (direction === "all") {
      where[Op.or] = [{ createdByUserId: userId }, { receiverUserId: userId }];
    } else {
      where.createdByUserId = userId;
    }
    if (status) {
      where.status = { [Op.in]: status.split(",") };
    }

    const { rows, count } = await ScheduledTransfer.findAndCountAll({
      where,
      include: PARTY_INCLUDES,
      order: [["scheduledFor", "ASC"]],
      limit: Math.min(parseInt(limit) || 20, 100),
      offset: parseInt(offset) || 0,
    });

    res.status(200).json({ success: true, data: rows, total: count });
  } catch (error) {
    handleControllerError(res, error, "List scheduled transfers");
  }
};

const getScheduledTransferById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const st = await ScheduledTransfer.findByPk(id, {
      include: [...PARTY_INCLUDES, { model: TransactionModel, as: "executedTransactions" }],
    });
    if (!st) throw new ControllerError(404, "Scheduled transfer not found");
    if (st.createdByUserId !== userId && st.receiverUserId !== userId) {
      throw new ControllerError(403, "Not authorized to view this scheduled transfer");
    }

    res.status(200).json({ success: true, data: st });
  } catch (error) {
    handleControllerError(res, error, "Get scheduled transfer");
  }
};

const updateScheduledTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { amount, scheduledFor, description, categoryId, applyConstraints, recurrence, pin } = req.body;

    let updated: any;

    await sequelize.transaction(async (t: any) => {
      const st = await ScheduledTransfer.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!st) throw new ControllerError(404, "Scheduled transfer not found");
      if (st.createdByUserId !== userId) throw new ControllerError(403, "Not authorized to edit this scheduled transfer");
      if (!EDITABLE_STATUSES.includes(st.status)) {
        throw new ControllerError(400, "Only scheduled or held transfers can be edited");
      }

      const newScheduledFor = scheduledFor !== undefined ? validateScheduledFor(scheduledFor) : st.scheduledFor;

      if (recurrence !== undefined && recurrence !== null) {
        const ruleCheck = validateRecurrenceRule(recurrence);
        if (!ruleCheck.valid) throw new ControllerError(400, ruleCheck.error!);
      }

      const amountChanged = amount !== undefined && parseFloat(amount) !== parseFloat(st.amount.toString());

      if (amountChanged) {
        if (parseFloat(amount) <= 0) throw new ControllerError(400, "Amount must be greater than 0");
        if (st.senderUserId) {
          await verifyPin(userId, pin);
        }

        if (st.status === "held") {
          await releaseHoldForOccurrence(st, t);
        }
        await st.update({ amount: parseFloat(amount), heldAmount: null, heldAt: null }, { transaction: t });

        const holdOutcome = await placeHoldForOccurrence(st, t);
        if (!holdOutcome.ok) {
          throw new ControllerError(400, holdOutcome.message || "Insufficient funds for the updated amount");
        }
        await st.update(
          { status: "held", heldAmount: holdOutcome.heldAmount, heldAt: new Date(), pinVerifiedAt: new Date() },
          { transaction: t }
        );
      }

      await st.update(
        {
          scheduledFor: newScheduledFor,
          description: description !== undefined ? description : st.description,
          categoryId: categoryId !== undefined ? categoryId : st.categoryId,
          applyConstraints: applyConstraints !== undefined ? applyConstraints : st.applyConstraints,
          recurrenceRule: recurrence !== undefined ? recurrence : st.recurrenceRule,
        },
        { transaction: t }
      );

      updated = st;
    });

    res.status(200).json({ success: true, message: "Scheduled transfer updated", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Update scheduled transfer");
  }
};

const cancelScheduledTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let cancelled: any;

    await sequelize.transaction(async (t: any) => {
      const st = await ScheduledTransfer.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!st) throw new ControllerError(404, "Scheduled transfer not found");
      if (st.createdByUserId !== userId) throw new ControllerError(403, "Not authorized to cancel this scheduled transfer");
      if (!["scheduled", "held", "paused"].includes(st.status)) {
        throw new ControllerError(400, "This scheduled transfer can no longer be cancelled");
      }
      if (st.status === "held") {
        await releaseHoldForOccurrence(st, t);
      }
      await st.update({ status: "cancelled", heldAmount: null, heldAt: null }, { transaction: t });
      cancelled = st;
    });

    await notifyScheduledTransferCancelled(req.app, userId, cancelled.id, cancelled.amount, cancelled.currency);
    res.status(200).json({ success: true, message: "Scheduled transfer cancelled", data: cancelled });
  } catch (error) {
    handleControllerError(res, error, "Cancel scheduled transfer");
  }
};

const pauseScheduledTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let paused: any;

    await sequelize.transaction(async (t: any) => {
      const st = await ScheduledTransfer.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!st) throw new ControllerError(404, "Scheduled transfer not found");
      if (st.createdByUserId !== userId) throw new ControllerError(403, "Not authorized to pause this scheduled transfer");
      if (!st.recurrenceRule) throw new ControllerError(400, "Only recurring transfers can be paused");
      if (!["scheduled", "held"].includes(st.status)) {
        throw new ControllerError(400, "This scheduled transfer cannot be paused right now");
      }
      if (st.status === "held") {
        await releaseHoldForOccurrence(st, t);
      }
      await st.update({ status: "paused", heldAmount: null, heldAt: null }, { transaction: t });
      paused = st;
    });

    await notifyScheduledTransferPaused(req.app, userId, paused.id);
    res.status(200).json({ success: true, message: "Scheduled transfer paused", data: paused });
  } catch (error) {
    handleControllerError(res, error, "Pause scheduled transfer");
  }
};

const resumeScheduledTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let resumed: any;

    await sequelize.transaction(async (t: any) => {
      const st = await ScheduledTransfer.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!st) throw new ControllerError(404, "Scheduled transfer not found");
      if (st.createdByUserId !== userId) throw new ControllerError(403, "Not authorized to resume this scheduled transfer");
      if (st.status !== "paused") throw new ControllerError(400, "Only paused transfers can be resumed");

      const withinWindow =
        st.scheduledFor.getTime() - Date.now() <= ROLLING_HOLD_WINDOW_HOURS * 60 * 60 * 1000;
      const holdOutcome = withinWindow ? await placeHoldForOccurrence(st, t) : null;

      if (holdOutcome?.ok) {
        await st.update(
          {
            status: "held",
            heldAmount: holdOutcome.heldAmount,
            heldAt: new Date(),
            consecutiveFailureCount: 0,
            lastFailureReason: null,
          },
          { transaction: t }
        );
      } else {
        await st.update({ status: "scheduled", consecutiveFailureCount: 0, lastFailureReason: null }, { transaction: t });
      }
      resumed = st;
    });

    await notifyScheduledTransferResumed(req.app, userId, resumed.id);
    res.status(200).json({ success: true, message: "Scheduled transfer resumed", data: resumed });
  } catch (error) {
    handleControllerError(res, error, "Resume scheduled transfer");
  }
};

const skipNextOccurrence = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let updated: any;

    await sequelize.transaction(async (t: any) => {
      const st = await ScheduledTransfer.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!st) throw new ControllerError(404, "Scheduled transfer not found");
      if (st.createdByUserId !== userId) throw new ControllerError(403, "Not authorized to modify this scheduled transfer");
      if (!st.recurrenceRule) throw new ControllerError(400, "Only recurring transfers support skipping an occurrence");
      if (!["scheduled", "held"].includes(st.status)) {
        throw new ControllerError(400, "This occurrence cannot be skipped right now");
      }

      if (st.status === "held") {
        await releaseHoldForOccurrence(st, t);
      }

      const nextRun = computeNextRun(st.scheduledFor, st.timezone, st.recurrenceRule);
      if (isRecurrenceExhausted(st.recurrenceRule, st.occurrenceCount, nextRun)) {
        await st.update({ status: "completed", heldAmount: null, heldAt: null }, { transaction: t });
      } else {
        await st.update({ status: "scheduled", scheduledFor: nextRun, heldAmount: null, heldAt: null }, { transaction: t });
      }
      updated = st;
    });

    res.status(200).json({ success: true, message: "Occurrence skipped", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Skip scheduled transfer occurrence");
  }
};

export default {
  createScheduledTransfer,
  listScheduledTransfers,
  getScheduledTransferById,
  updateScheduledTransfer,
  cancelScheduledTransfer,
  pauseScheduledTransfer,
  resumeScheduledTransfer,
  skipNextOccurrence,
  createScheduledBatchTransfer,
  listScheduledBatches,
  getScheduledBatchById,
  cancelScheduledBatch,
};
