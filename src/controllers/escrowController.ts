import { Response } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import * as bcrypt from "bcrypt";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";
import { getAvailableBalance } from "../utils/walletBalance";
import { holdEscrowFunds, releaseEscrowFunds, refundEscrowFunds } from "../services/escrowService";
import { notifyPaymentReceived, notifyPaymentSent } from "../utils/notificationHelpers";

const { sequelize, Wallet, Escrow, User, ChatParticipant, ChatMessage } = database_models as any;

const PARTY_INCLUDES = [
  { model: User, as: "payerUser", attributes: ["id", "firstName", "lastName"] },
  { model: User, as: "payeeUser", attributes: ["id", "firstName", "lastName"] },
];

const MIN_AUTO_RELEASE_LEAD_MINUTES = 60;
const MAX_AUTO_RELEASE_HORIZON_DAYS = 90;

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

const validateAutoReleaseAt = (value: unknown): Date => {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) throw new ControllerError(400, "autoReleaseAt must be a valid date");

  const now = new Date();
  const minAllowed = new Date(now.getTime() + MIN_AUTO_RELEASE_LEAD_MINUTES * 60000);
  const maxAllowed = new Date(now.getTime() + MAX_AUTO_RELEASE_HORIZON_DAYS * 24 * 60 * 60000);

  if (date < minAllowed) {
    throw new ControllerError(400, `autoReleaseAt must be at least ${MIN_AUTO_RELEASE_LEAD_MINUTES} minutes in the future`);
  }
  if (date > maxAllowed) {
    throw new ControllerError(400, `autoReleaseAt cannot be more than ${MAX_AUTO_RELEASE_HORIZON_DAYS} days in the future`);
  }
  return date;
};

/**
 * Opens an escrow: funds are reserved (heldBalance) against the payer's wallet
 * immediately, but nothing reaches the payee until release. Fails outright if funds
 * aren't available, same as scheduled transfers.
 */
const createEscrow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      payeeUserId,
      amount,
      description = "",
      releaseMode = "manual",
      autoReleaseAt,
      pin,
      chatId,
    } = req.body;

    const authenticatedUserId = req.user.id;

    if (!payeeUserId || !amount || parseFloat(amount) <= 0) {
      throw new ControllerError(400, "payeeUserId and an amount greater than 0 are required");
    }
    if (payeeUserId === authenticatedUserId) {
      throw new ControllerError(400, "Cannot open an escrow with yourself");
    }
    if (!["manual", "auto_timeout"].includes(releaseMode)) {
      throw new ControllerError(400, "releaseMode must be 'manual' or 'auto_timeout'");
    }

    let autoReleaseDate: Date | null = null;
    if (releaseMode === "auto_timeout") {
      autoReleaseDate = validateAutoReleaseAt(autoReleaseAt);
    }

    if (chatId) {
      const [payerParticipant, payeeParticipant] = await Promise.all([
        ChatParticipant.findOne({ where: { chatId, userId: authenticatedUserId } }),
        ChatParticipant.findOne({ where: { chatId, userId: payeeUserId } }),
      ]);
      if (!payerParticipant) throw new ControllerError(403, "You are not a participant in this chat");
      if (!payeeParticipant) throw new ControllerError(400, "Payee is not a participant in this chat");
    }

    await verifyPin(authenticatedUserId, pin);

    const payeeWallet = await Wallet.findOne({ where: { userId: payeeUserId, isActive: true } });
    if (!payeeWallet) throw new ControllerError(404, "Payee wallet not found or inactive");

    const escrowAmount = parseFloat(amount);
    let created: any;

    await sequelize.transaction(async (t: DbTransaction) => {
      const payerWallet = await Wallet.findOne({
        where: { userId: authenticatedUserId, isActive: true },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!payerWallet) throw new ControllerError(404, "Your wallet not found or inactive");

      if (getAvailableBalance(payerWallet) < escrowAmount) {
        throw new ControllerError(
          400,
          `Insufficient balance. You have ${getAvailableBalance(payerWallet)} ${payerWallet.currency}, but need ${escrowAmount}`
        );
      }

      await holdEscrowFunds(payerWallet, escrowAmount, t);

      created = await Escrow.create(
        {
          chatId: chatId || null,
          payerWalletId: payerWallet.id,
          payeeWalletId: payeeWallet.id,
          payerUserId: authenticatedUserId,
          payeeUserId,
          amount: escrowAmount,
          currency: payerWallet.currency || "RWF",
          description,
          status: "held",
          releaseMode,
          autoReleaseAt: autoReleaseDate,
          fundedAt: new Date(),
        } as any,
        { transaction: t }
      );
    });

    let chatMessage: any = null;
    if (chatId) {
      chatMessage = await postEscrowChatMessage(req, chatId, authenticatedUserId, created, payeeUserId);
    }

    res.status(201).json({ success: true, message: "Funds placed in escrow", data: created, chatMessage });
  } catch (error) {
    handleControllerError(res, error, "Create escrow");
  }
};

/**
 * Drops a chat message announcing the hold and broadcasts it, same as sendMoneyInChat does
 * for a normal transfer - the escrow card in the thread is how both sides see/act on it.
 */
const postEscrowChatMessage = async (
  req: AuthenticatedRequest,
  chatId: string,
  senderId: string,
  escrow: any,
  payeeUserId: string
): Promise<any> => {
  const [payerUser, payeeUser] = await Promise.all([User.findByPk(senderId), User.findByPk(payeeUserId)]);

  const content = JSON.stringify({
    type: "escrow",
    escrowId: escrow.id,
    amount: parseFloat(escrow.amount.toString()),
    currency: escrow.currency,
    payerName: payerUser ? `${payerUser.firstName} ${payerUser.lastName}` : "Sender",
    payeeName: payeeUser ? `${payeeUser.firstName} ${payeeUser.lastName}` : "Recipient",
    description: escrow.description || "",
    releaseMode: escrow.releaseMode,
    autoReleaseAt: escrow.autoReleaseAt,
    timestamp: new Date().toISOString(),
  });

  const message = await ChatMessage.create({
    chatId,
    senderId,
    content,
    messageType: "escrow",
    isEncrypted: false,
    encryptionIv: "",
    status: "sent",
  });

  const messageWithSender = await ChatMessage.findByPk(message.id, {
    include: [{ model: User, as: "sender", attributes: ["id", "firstName", "lastName"] }],
  });

  const io = req.app.get("io");
  if (io) {
    const participants = await ChatParticipant.findAll({ where: { chatId }, attributes: ["userId"] });
    const broadcastMessage = messageWithSender!.toJSON();
    for (const p of participants) {
      io.to(`user_${p.userId}`).emit("new_message", broadcastMessage);
    }
  }

  return messageWithSender;
};

const listMyEscrows = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.user.id;
    const { status, role } = req.query as { status?: string; role?: "payer" | "payee" };

    const where: any = {};
    if (role === "payer") {
      where.payerUserId = authenticatedUserId;
    } else if (role === "payee") {
      where.payeeUserId = authenticatedUserId;
    } else {
      where[Op.or as any] = [{ payerUserId: authenticatedUserId }, { payeeUserId: authenticatedUserId }];
    }
    if (status) where.status = status;

    const escrows = await Escrow.findAll({ where, include: PARTY_INCLUDES, order: [["createdAt", "DESC"]] });
    res.status(200).json({ success: true, data: escrows });
  } catch (error) {
    handleControllerError(res, error, "List escrows");
  }
};

const getEscrowById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const escrow = await Escrow.findByPk(id, { include: PARTY_INCLUDES });
    if (!escrow) throw new ControllerError(404, "Escrow not found");
    if (escrow.payerUserId !== authenticatedUserId && escrow.payeeUserId !== authenticatedUserId) {
      throw new ControllerError(403, "Not authorized to view this escrow");
    }

    res.status(200).json({ success: true, data: escrow });
  } catch (error) {
    handleControllerError(res, error, "Get escrow");
  }
};

/** Only the payer can release - they're the one confirming the condition was met. */
const releaseEscrow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    let updated: any;
    let releaseResult: { transactionId: string } | null = null;

    await sequelize.transaction(async (t: DbTransaction) => {
      const escrow = await Escrow.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!escrow) throw new ControllerError(404, "Escrow not found");
      if (escrow.payerUserId !== authenticatedUserId) {
        throw new ControllerError(403, "Only the payer can release these funds");
      }
      if (escrow.status !== "held") {
        throw new ControllerError(400, `Escrow cannot be released from status '${escrow.status}'`);
      }

      releaseResult = await releaseEscrowFunds(escrow, t);
      await escrow.update(
        { status: "released", releasedAt: new Date(), releaseTransactionId: releaseResult.transactionId },
        { transaction: t }
      );
      updated = escrow;
    });

    if (releaseResult) {
      const [payerUser, payeeUser] = await Promise.all([
        User.findByPk(updated.payerUserId),
        User.findByPk(updated.payeeUserId),
      ]);
      const amount = parseFloat(updated.amount.toString());
      if (payeeUser && payerUser) {
        await notifyPaymentReceived(
          req.app,
          updated.payeeUserId,
          (releaseResult as { transactionId: string }).transactionId,
          amount,
          updated.currency,
          `${payerUser.firstName} ${payerUser.lastName}`
        );
        await notifyPaymentSent(
          req.app,
          updated.payerUserId,
          (releaseResult as { transactionId: string }).transactionId,
          amount,
          updated.currency,
          `${payeeUser.firstName} ${payeeUser.lastName}`
        );
      }
    }

    res.status(200).json({ success: true, message: "Escrow released", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Release escrow");
  }
};

/** Only the payer can cancel a still-held escrow unilaterally; disputes go through an admin. */
const refundEscrow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.id;
    let updated: any;

    await sequelize.transaction(async (t: DbTransaction) => {
      const escrow = await Escrow.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!escrow) throw new ControllerError(404, "Escrow not found");
      if (escrow.payerUserId !== authenticatedUserId) {
        throw new ControllerError(403, "Only the payer can cancel this escrow");
      }
      if (escrow.status !== "held") {
        throw new ControllerError(400, `Escrow cannot be refunded from status '${escrow.status}'`);
      }

      await refundEscrowFunds(escrow, t);
      await escrow.update({ status: "refunded", refundedAt: new Date() }, { transaction: t });
      updated = escrow;
    });

    res.status(200).json({ success: true, message: "Escrow refunded", data: updated });
  } catch (error) {
    handleControllerError(res, error, "Refund escrow");
  }
};

/** Either party can flag a held escrow; this freezes it until an admin resolves it. */
const raiseDispute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const authenticatedUserId = req.user.id;

    if (!reason) throw new ControllerError(400, "A dispute reason is required");

    const escrow = await Escrow.findByPk(id);
    if (!escrow) throw new ControllerError(404, "Escrow not found");
    if (escrow.payerUserId !== authenticatedUserId && escrow.payeeUserId !== authenticatedUserId) {
      throw new ControllerError(403, "Only the payer or payee can dispute this escrow");
    }
    if (escrow.status !== "held") {
      throw new ControllerError(400, `Escrow cannot be disputed from status '${escrow.status}'`);
    }

    await escrow.update({
      status: "disputed",
      disputeRaisedBy: authenticatedUserId,
      disputeReason: reason,
      disputeRaisedAt: new Date(),
    });

    res.status(200).json({ success: true, message: "Dispute raised", data: escrow });
  } catch (error) {
    handleControllerError(res, error, "Raise escrow dispute");
  }
};

/** Admin-only (gated at the route level) - decides a disputed escrow one way or the other. */
const resolveDispute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, note } = req.body as { action?: "release" | "refund"; note?: string };
    const adminId = req.user.id;

    if (action !== "release" && action !== "refund") {
      throw new ControllerError(400, "action must be 'release' or 'refund'");
    }

    let updated: any;
    let releaseResult: { transactionId: string } | null = null;

    await sequelize.transaction(async (t: DbTransaction) => {
      const escrow = await Escrow.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!escrow) throw new ControllerError(404, "Escrow not found");
      if (escrow.status !== "disputed") {
        throw new ControllerError(400, "Only disputed escrows can be resolved");
      }

      if (action === "release") {
        releaseResult = await releaseEscrowFunds(escrow, t);
        await escrow.update(
          {
            status: "released",
            releasedAt: new Date(),
            releaseTransactionId: releaseResult.transactionId,
            resolvedByAdminId: adminId,
            resolutionNote: note || null,
            resolvedAt: new Date(),
          },
          { transaction: t }
        );
      } else {
        await refundEscrowFunds(escrow, t);
        await escrow.update(
          {
            status: "refunded",
            refundedAt: new Date(),
            resolvedByAdminId: adminId,
            resolutionNote: note || null,
            resolvedAt: new Date(),
          },
          { transaction: t }
        );
      }
      updated = escrow;
    });

    res.status(200).json({ success: true, message: `Dispute resolved: escrow ${action}d`, data: updated });
  } catch (error) {
    handleControllerError(res, error, "Resolve escrow dispute");
  }
};

export default {
  createEscrow,
  listMyEscrows,
  getEscrowById,
  releaseEscrow,
  refundEscrow,
  raiseDispute,
  resolveDispute,
};
