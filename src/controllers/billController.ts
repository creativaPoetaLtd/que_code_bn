import { Response } from "express";
import { Op, Transaction as DbTransaction } from "sequelize";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import { verifyTransactionPin, PinVerificationError } from "../utils/verifyPin";
import { resolveWalletWhere, validateFundsAvailability } from "../utils/transferValidation";
import { getAvailableBalance } from "../utils/walletBalance";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification } from "../utils/notificationService";
import { notifyPaymentReceived, notifyPaymentRequestReceived } from "../utils/notificationHelpers";
import { broadcastToBillParticipants } from "../utils/billBroadcast";

const MAX_SHARES = 30;
const REMIND_COOLDOWN_MS = 60 * 60 * 1000;
// A share is "open" while it can still be paid: nothing has settled it yet.
const OPEN_SHARE_STATUSES = ["pending", "declined"];
const SETTLED_IN_APP_STATUSES = ["paid", "covered"];

class BillError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getModels = (req: AuthenticatedRequest) => req.app.get("models") as ReturnType<typeof Models>;
const getIo = (req: AuthenticatedRequest) => req.app.get("io");

const handleControllerError = (res: Response, error: unknown, context: string): void => {
  if (error instanceof BillError || error instanceof PinVerificationError) {
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

const toMinor = (amount: number): number => Math.round(amount * 100);
const toNumber = (value: any): number => parseFloat(value.toString());
const fullName = (user: any): string => (user ? `${user.firstName} ${user.lastName}` : "Someone");
const isOpenShare = (status: string): boolean => OPEN_SHARE_STATUSES.includes(status);

const loadBill = async (models: ReturnType<typeof Models>, billId: string, t?: DbTransaction) => {
  const bill = await models.Bill.findByPk(billId, t ? { lock: t.LOCK.UPDATE, transaction: t } : undefined);
  if (!bill) throw new BillError(404, "Split not found");
  return bill;
};

const loadShare = async (
  models: ReturnType<typeof Models>,
  billId: string,
  shareId: string,
  t?: DbTransaction
) => {
  const share = await models.BillShare.findOne({
    where: { id: shareId, billId },
    ...(t ? { lock: t.LOCK.UPDATE, transaction: t } : {}),
  });
  if (!share) throw new BillError(404, "Share not found");
  return share;
};

const assertOpenBill = (bill: { status: string }) => {
  if (bill.status !== "open") throw new BillError(400, `This split is ${bill.status}`);
};

const assertOrganizer = (bill: { organizerId: string }, userId: string) => {
  if (bill.organizerId !== userId) throw new BillError(403, "Only the organizer can do this");
};

const participantIdsOf = async (models: ReturnType<typeof Models>, bill: { id: string; organizerId: string }) => {
  const shares = await models.BillShare.findAll({ where: { billId: bill.id }, attributes: ["payerId"] });
  return [bill.organizerId, ...shares.map((s) => s.payerId)];
};

const billUrl = (billId: string) => `/home/bills/${billId}`;

const notifyBill = (
  req: AuthenticatedRequest,
  recipientId: string,
  type: NotificationType,
  bill: { id: string; title: string },
  message: string,
  extra: { amount?: number; currency?: string; userName?: string } = {}
) =>
  createAndSendNotification(req.app, {
    type,
    recipientId,
    data: {
      billId: bill.id,
      billTitle: bill.title,
      message,
      url: billUrl(bill.id),
      ...extra,
    },
  });

// Side effects run after the DB transaction commits and must never turn a completed
// payment into an error response.
const safely = async (context: string, work: () => Promise<unknown>) => {
  try {
    await work();
  } catch (error) {
    console.error(`${context} side-effect error:`, error);
  }
};

const notifyCompleted = async (
  req: AuthenticatedRequest,
  models: ReturnType<typeof Models>,
  bill: { id: string; title: string; organizerId: string }
) => {
  const participants = Array.from(new Set(await participantIdsOf(models, bill)));
  await Promise.all(
    participants.map((userId) =>
      notifyBill(req, userId, NotificationType.BILL_COMPLETED, bill, `"${bill.title}" has been fully settled`)
    )
  );
};

/** If nothing is left to pay, mark the bill completed. Must run inside the bill-locked transaction. */
const completeIfSettled = async (
  models: ReturnType<typeof Models>,
  bill: any,
  t: DbTransaction
): Promise<boolean> => {
  if (bill.status !== "open") return false;
  const remaining = await models.BillShare.count({
    where: { billId: bill.id, status: { [Op.in]: OPEN_SHARE_STATUSES } },
    transaction: t,
  });
  if (remaining > 0) return false;
  await bill.update({ status: "completed", completedAt: new Date() }, { transaction: t });
  return true;
};

const billInclude = (models: ReturnType<typeof Models>) => [
  { model: models.User, as: "organizer", attributes: ["id", "firstName", "lastName"] },
  { model: models.User, as: "recipientUser", attributes: ["id", "firstName", "lastName"] },
  { model: models.Organization, as: "recipientOrganization", attributes: ["id", "name"] },
  {
    model: models.BillShare,
    as: "shares",
    include: [
      { model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] },
      { model: models.User, as: "paidBy", attributes: ["id", "firstName", "lastName"] },
    ],
  },
];

const recipientOf = (bill: any) => {
  if (bill.recipientOrganization) {
    return { id: bill.recipientOrganization.id, name: bill.recipientOrganization.name, type: "organization" };
  }
  if (bill.recipientUser) {
    return { id: bill.recipientUser.id, name: fullName(bill.recipientUser), type: "user" };
  }
  return null;
};

const sumOf = (shares: any[], statuses: string[]) =>
  shares.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + toNumber(s.amount), 0);

const serializeBill = (bill: any, viewerId: string) => {
  const shares: any[] = bill.shares || [];
  const myShare = shares.find((s) => s.payerId === viewerId);
  const isOrganizer = bill.organizerId === viewerId;
  return {
    id: bill.id,
    title: bill.title,
    note: bill.note,
    status: bill.status,
    currency: bill.currency,
    totalAmount: toNumber(bill.totalAmount),
    paidInAmount: sumOf(shares, SETTLED_IN_APP_STATUSES),
    outstandingAmount: sumOf(shares, OPEN_SHARE_STATUSES),
    recipient: recipientOf(bill),
    organizer: { id: bill.organizerId, name: fullName(bill.organizer) },
    role: isOrganizer ? "organizer" : "payer",
    myShareId: myShare ? myShare.id : null,
    canCancel: isOrganizer && bill.status === "open" && !shares.some((s) => SETTLED_IN_APP_STATUSES.includes(s.status)),
    completedAt: bill.completedAt,
    createdAt: bill.createdAt,
    shares: shares
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((s) => ({
        id: s.id,
        payerId: s.payerId,
        payerName: fullName(s.payer),
        amount: toNumber(s.amount),
        status: s.status,
        paidByUserId: s.paidByUserId,
        paidByName: s.paidBy ? fullName(s.paidBy) : null,
        declineNote: s.declineNote,
        settledAt: s.settledAt,
      })),
  };
};

/**
 * POST /bills
 * Creates a split: one recipient (a user OR an organization), a fixed total, and one exact
 * share per named payer. No money moves here, so no PIN.
 */
export const createBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const organizerId = req.user.id;
    const { recipientUserId, recipientOrganizationId, totalAmount, title, note, shares } = req.body;

    const recipientTargets = [recipientUserId, recipientOrganizationId].filter(Boolean).length;
    if (recipientTargets !== 1) {
      throw new BillError(400, "Exactly one recipient (a person or an organization) is required");
    }
    if (recipientUserId && recipientUserId === organizerId) {
      throw new BillError(400, "You can't split a payment to yourself");
    }

    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      throw new BillError(400, "A total amount greater than 0 is required");
    }
    if (!Array.isArray(shares) || shares.length < 1 || shares.length > MAX_SHARES) {
      throw new BillError(400, `A split needs between 1 and ${MAX_SHARES} shares`);
    }

    const cleanTitle = String(title || "Split bill").trim().slice(0, 100) || "Split bill";
    const cleanNote = note ? String(note).trim().slice(0, 250) : null;

    const payerIds = shares.map((s: any) => s?.payerId);
    if (payerIds.some((id: any) => !id || typeof id !== "string")) {
      throw new BillError(400, "Every share needs a payer");
    }
    if (new Set(payerIds).size !== payerIds.length) {
      throw new BillError(400, "Each person can only have one share");
    }
    if (recipientUserId && payerIds.includes(recipientUserId)) {
      throw new BillError(400, "The recipient can't also be one of the payers");
    }
    const shareAmounts: number[] = shares.map((s: any) => Number(s?.amount));
    if (shareAmounts.some((a) => !Number.isFinite(a) || a <= 0)) {
      throw new BillError(400, "Every share needs an amount greater than 0");
    }
    if (shareAmounts.reduce((sum, a) => sum + toMinor(a), 0) !== toMinor(total)) {
      throw new BillError(400, "The shares must add up exactly to the total");
    }

    // Same trust model as shared wallets: you can only assign shares to your own contacts.
    const others: string[] = payerIds.filter((id: string) => id !== organizerId);
    if (others.length > 0) {
      const contacts = await models.Contact.findAll({
        where: {
          [Op.or]: [
            { userAId: organizerId, status: "active" },
            { userBId: organizerId, status: "active" },
          ],
        },
      });
      const contactUserIds = new Set(contacts.map((c) => (c.userAId === organizerId ? c.userBId : c.userAId)));
      if (others.some((id) => !contactUserIds.has(id))) {
        throw new BillError(400, "Everyone in the split must be one of your contacts");
      }
    }

    const recipientWallet = await models.Wallet.findOne({
      where: resolveWalletWhere({ userId: recipientUserId, organizationId: recipientOrganizationId }) as any,
    });
    if (!recipientWallet) throw new BillError(404, "Recipient wallet not found or inactive");

    let bill: any;
    await models.sequelize.transaction(async (t: DbTransaction) => {
      bill = await models.Bill.create(
        {
          organizerId,
          recipientUserId: recipientUserId || null,
          recipientOrganizationId: recipientOrganizationId || null,
          totalAmount: total,
          currency: recipientWallet.currency || "RWF",
          title: cleanTitle,
          note: cleanNote,
        } as any,
        { transaction: t }
      );
      for (let i = 0; i < shares.length; i++) {
        await models.BillShare.create(
          { billId: bill.id, payerId: shares[i].payerId, amount: shareAmounts[i] } as any,
          { transaction: t }
        );
      }
    });

    await safely("Create bill", async () => {
      const organizer = await models.User.findByPk(organizerId);
      const recipient = recipientUserId
        ? fullName(await models.User.findByPk(recipientUserId))
        : (await models.Organization.findByPk(recipientOrganizationId))?.name || "the recipient";
      await Promise.all(
        others.map((payerId, _i) => {
          const amount = shareAmounts[payerIds.indexOf(payerId)];
          return notifyBill(
            req,
            payerId,
            NotificationType.BILL_SHARE_ASSIGNED,
            bill,
            `${fullName(organizer)} split "${cleanTitle}" - your share is ${amount} ${bill.currency} to ${recipient}`,
            { amount, currency: bill.currency, userName: fullName(organizer) }
          );
        })
      );
    });

    res.status(201).json({ success: true, message: "Split created", data: { id: bill.id } });
  } catch (error) {
    handleControllerError(res, error, "Create bill");
  }
};

/** GET /bills - splits I organized or owe a share of. Optional ?role=organizer|payer. */
export const listMyBills = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    const role = req.query.role as string | undefined;

    const myShares = await models.BillShare.findAll({ where: { payerId: userId }, attributes: ["billId"] });
    const payerBillIds = myShares.map((s) => s.billId);

    const whereOr: any[] = [];
    if (role !== "payer") whereOr.push({ organizerId: userId });
    if (role !== "organizer" && payerBillIds.length > 0) whereOr.push({ id: { [Op.in]: payerBillIds } });
    if (whereOr.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const bills = await models.Bill.findAll({
      where: { [Op.or]: whereOr },
      include: billInclude(models),
      order: [["createdAt", "DESC"]],
      limit: 100,
    });

    const data = bills.map((b: any) => {
      const detail = serializeBill(b, userId);
      const myShare = detail.shares.find((s) => s.id === detail.myShareId) || null;
      return {
        id: detail.id,
        title: detail.title,
        status: detail.status,
        currency: detail.currency,
        totalAmount: detail.totalAmount,
        paidInAmount: detail.paidInAmount,
        recipient: detail.recipient,
        organizer: detail.organizer,
        role: detail.role,
        sharesCount: detail.shares.length,
        myShare: myShare ? { id: myShare.id, amount: myShare.amount, status: myShare.status } : null,
        createdAt: detail.createdAt,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    handleControllerError(res, error, "List my bills");
  }
};

/** GET /bills/:id - visible to the organizer and anyone with a share. */
export const getBillById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    const bill: any = await models.Bill.findByPk(req.params.id, { include: billInclude(models) });

    const isParticipant =
      bill && (bill.organizerId === userId || (bill.shares || []).some((s: any) => s.payerId === userId));
    // 404 (not 403) so bill ids can't be probed by non-participants.
    if (!bill || !isParticipant) throw new BillError(404, "Split not found");

    res.status(200).json({ success: true, data: serializeBill(bill, userId) });
  } catch (error) {
    handleControllerError(res, error, "Get bill");
  }
};

interface ExecutePaymentParams {
  billId: string;
  shareId: string;
  payingUserId: string;
  mode: "pay" | "cover";
  requestReimbursement: boolean;
}

/**
 * The one place a share gets paid - used by both `pay` (the payer settles their own share)
 * and `cover` (someone else settles it). Money goes straight from the paying user's wallet
 * to the recipient's wallet; nothing is pooled.
 */
const executeSharePayment = async (
  req: AuthenticatedRequest,
  models: ReturnType<typeof Models>,
  params: ExecutePaymentParams
) => {
  const { billId, shareId, payingUserId, mode, requestReimbursement } = params;

  const outcome = await models.sequelize.transaction(async (t: DbTransaction) => {
    // Locking the bill first serializes every payment on it, so two concurrent last
    // payments can't each see the other's share as still open and both skip completion.
    const bill = await loadBill(models, billId, t);
    assertOpenBill(bill);
    const share = await loadShare(models, billId, shareId, t);
    if (!isOpenShare(share.status)) throw new BillError(400, "This share has already been settled");

    if (mode === "pay") {
      if (share.payerId !== payingUserId) throw new BillError(403, "You can only pay your own share");
    } else {
      if (share.payerId === payingUserId) throw new BillError(400, "Use pay to settle your own share");
      if (bill.recipientUserId && bill.recipientUserId === payingUserId) {
        throw new BillError(400, "The recipient can't cover a share");
      }
      const onBill =
        bill.organizerId === payingUserId ||
        (await models.BillShare.count({ where: { billId, payerId: payingUserId }, transaction: t })) > 0;
      if (!onBill) throw new BillError(403, "Only people on this split can cover a share");
    }

    const amount = toNumber(share.amount);

    // Find both wallets, then lock them together in id order so two payments crossing
    // between the same pair of wallets can never deadlock.
    const payerLookup = await models.Wallet.findOne({
      where: { userId: payingUserId, isActive: true },
      transaction: t,
    });
    const recipientLookup = await models.Wallet.findOne({
      where: resolveWalletWhere({
        userId: bill.recipientUserId,
        organizationId: bill.recipientOrganizationId,
      }) as any,
      transaction: t,
    });
    if (!payerLookup) throw new BillError(404, "Your wallet was not found or is inactive");
    if (!recipientLookup) throw new BillError(404, "Recipient wallet not found or inactive");
    if (payerLookup.id === recipientLookup.id) throw new BillError(400, "Cannot pay the same wallet");

    const locked = await models.Wallet.findAll({
      where: { id: { [Op.in]: [payerLookup.id, recipientLookup.id] } },
      order: [["id", "ASC"]],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    const payerWallet = locked.find((w) => w.id === payerLookup.id)!;
    const recipientWallet = locked.find((w) => w.id === recipientLookup.id)!;

    const restrictions = await models.WalletRestriction.findAll({
      where: { walletId: payerWallet.id },
      include: [{ model: models.Category, as: "category", required: true }],
      transaction: t,
    });
    // No category on purpose: split payments only ever draw on unrestricted funds.
    const validation = validateFundsAvailability({
      availableBalance: getAvailableBalance(payerWallet),
      restrictions: restrictions as any,
      transferAmount: amount,
      receiverIsUser: !!recipientWallet.userId,
      categoryId: undefined,
    });
    if (!validation.ok) throw new BillError(400, validation.message || "Insufficient balance");

    const payer = await models.User.findByPk(share.payerId, { transaction: t });
    const payingUser = mode === "pay" ? payer : await models.User.findByPk(payingUserId, { transaction: t });

    await payerWallet.decrement("balance", { by: amount, transaction: t });
    await recipientWallet.increment("balance", { by: amount, transaction: t });

    const description =
      mode === "pay"
        ? `Split bill: ${bill.title} - ${fullName(payer)}`
        : `Split bill: ${bill.title} - ${fullName(payer)}'s share (covered by ${fullName(payingUser)})`;

    const transaction = await models.Transaction.create(
      {
        referenceId: `BILL${Date.now()}${Math.floor(Math.random() * 1000)}`,
        senderWalletId: payerWallet.id,
        receiverWalletId: recipientWallet.id,
        amount,
        fee: 0,
        totalAmount: amount,
        currency: payerWallet.currency,
        status: "completed",
        type: "payment",
        description,
        hasAccount: true,
        billShareId: share.id,
      } as any,
      { transaction: t }
    );

    await share.update(
      {
        status: mode === "pay" ? "paid" : "covered",
        paidByUserId: payingUserId,
        transactionId: transaction.id,
        settledAt: new Date(),
      },
      { transaction: t }
    );

    let paymentRequest: any = null;
    if (mode === "cover" && requestReimbursement) {
      paymentRequest = await models.PaymentRequest.create(
        {
          senderId: payingUserId,
          recipientId: share.payerId,
          amount,
          currency: payerWallet.currency,
          note: `Covered your share of "${bill.title}"`,
          status: "pending",
          allowEditAmount: false,
        } as any,
        { transaction: t }
      );
    }

    const completed = await completeIfSettled(models, bill, t);

    return { bill, share, transaction, paymentRequest, completed, amount, payer, payingUser };
  });

  await safely("Bill payment", async () => {
    const { bill, share, transaction, paymentRequest, completed, amount, payer, payingUser } = outcome;
    const currency = bill.currency;
    const participants = await participantIdsOf(models, bill);
    broadcastToBillParticipants(getIo(req), participants, bill.id, "bill_updated", {
      status: bill.status,
      shareId: share.id,
      shareStatus: share.status,
    });

    if (mode === "pay") {
      if (bill.organizerId !== payingUserId) {
        await notifyBill(
          req,
          bill.organizerId,
          NotificationType.BILL_SHARE_PAID,
          bill,
          `${fullName(payer)} paid their share (${amount} ${currency}) of "${bill.title}"`,
          { amount, currency, userName: fullName(payer) }
        );
      }
    } else {
      await notifyBill(
        req,
        share.payerId,
        NotificationType.BILL_SHARE_COVERED,
        bill,
        `${fullName(payingUser)} covered your ${amount} ${currency} share of "${bill.title}"`,
        { amount, currency, userName: fullName(payingUser) }
      );
      if (bill.organizerId !== payingUserId && bill.organizerId !== share.payerId) {
        await notifyBill(
          req,
          bill.organizerId,
          NotificationType.BILL_SHARE_PAID,
          bill,
          `${fullName(payingUser)} covered ${fullName(payer)}'s share (${amount} ${currency}) of "${bill.title}"`,
          { amount, currency, userName: fullName(payingUser) }
        );
      }
      if (paymentRequest) {
        await notifyPaymentRequestReceived(
          req.app,
          share.payerId,
          paymentRequest.id,
          amount,
          currency,
          fullName(payingUser),
          paymentRequest.note || undefined
        );
      }
    }

    // A business recipient has no in-app notifications (they are user-only); it simply
    // sees the payment land in its wallet.
    if (bill.recipientUserId) {
      await notifyPaymentReceived(req.app, bill.recipientUserId, transaction.id, amount, currency, fullName(payingUser));
    }

    if (completed) await notifyCompleted(req, models, bill);
  });

  return outcome;
};

/** POST /bills/:id/shares/:shareId/pay - the payer settles their own share (PIN). */
export const payShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    await verifyTransactionPin(userId, req.body.pin);

    const { completed } = await executeSharePayment(req, models, {
      billId: req.params.id,
      shareId: req.params.shareId,
      payingUserId: userId,
      mode: "pay",
      requestReimbursement: false,
    });

    res.status(200).json({ success: true, message: "Share paid", data: { completed } });
  } catch (error) {
    handleControllerError(res, error, "Pay bill share");
  }
};

/**
 * POST /bills/:id/shares/:shareId/cover
 * Someone else on the split pays a share that isn't being paid (PIN). By default the app
 * also sends the payer a payment request for that amount, so the IOU is on record.
 */
export const coverShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    await verifyTransactionPin(userId, req.body.pin);

    const { completed, paymentRequest } = await executeSharePayment(req, models, {
      billId: req.params.id,
      shareId: req.params.shareId,
      payingUserId: userId,
      mode: "cover",
      requestReimbursement: req.body.requestReimbursement !== false,
    });

    res.status(200).json({
      success: true,
      message: "Share covered",
      data: { completed, reimbursementRequestId: paymentRequest ? paymentRequest.id : null },
    });
  } catch (error) {
    handleControllerError(res, error, "Cover bill share");
  }
};

/** POST /bills/:id/shares/:shareId/decline - the payer says they won't pay this (still payable until resolved). */
export const declineShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    const note = req.body.note ? String(req.body.note).trim().slice(0, 200) : null;

    const outcome = await models.sequelize.transaction(async (t: DbTransaction) => {
      const bill = await loadBill(models, req.params.id, t);
      assertOpenBill(bill);
      const share = await loadShare(models, bill.id, req.params.shareId, t);
      if (share.payerId !== userId) throw new BillError(403, "You can only decline your own share");
      if (share.status !== "pending") throw new BillError(400, `A ${share.status} share can't be declined`);
      await share.update({ status: "declined", declineNote: note }, { transaction: t });
      return { bill, share };
    });

    await safely("Decline bill share", async () => {
      const { bill, share } = outcome;
      const participants = await participantIdsOf(models, bill);
      broadcastToBillParticipants(getIo(req), participants, bill.id, "bill_updated", {
        status: bill.status,
        shareId: share.id,
        shareStatus: share.status,
      });
      if (bill.organizerId !== userId) {
        const decliner = await models.User.findByPk(userId);
        await notifyBill(
          req,
          bill.organizerId,
          NotificationType.BILL_SHARE_DECLINED,
          bill,
          `${fullName(decliner)} declined their share of "${bill.title}"${note ? `: ${note}` : ""}`,
          { amount: toNumber(share.amount), currency: bill.currency, userName: fullName(decliner) }
        );
      }
    });

    res.status(200).json({ success: true, message: "Share declined" });
  } catch (error) {
    handleControllerError(res, error, "Decline bill share");
  }
};

/** POST /bills/:id/shares/:shareId/reassign - organizer hands an unpaid share to someone else (same amount). */
export const reassignShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;
    const { newPayerId } = req.body;
    if (!newPayerId || typeof newPayerId !== "string") throw new BillError(400, "newPayerId is required");

    const outcome = await models.sequelize.transaction(async (t: DbTransaction) => {
      const bill = await loadBill(models, req.params.id, t);
      assertOpenBill(bill);
      assertOrganizer(bill, userId);
      const share = await loadShare(models, bill.id, req.params.shareId, t);
      if (!isOpenShare(share.status)) throw new BillError(400, `A ${share.status} share can't be reassigned`);

      if (newPayerId === share.payerId) throw new BillError(400, "That person already has this share");
      if (bill.recipientUserId && newPayerId === bill.recipientUserId) {
        throw new BillError(400, "The recipient can't also be a payer");
      }
      const alreadyOnBill = await models.BillShare.count({
        where: { billId: bill.id, payerId: newPayerId },
        transaction: t,
      });
      if (alreadyOnBill > 0) throw new BillError(400, "That person already has a share in this split");

      if (newPayerId !== userId) {
        const contact = await models.Contact.findOne({
          where: {
            [Op.or]: [
              { userAId: userId, userBId: newPayerId },
              { userAId: newPayerId, userBId: userId },
            ],
            status: "active",
          },
          transaction: t,
        });
        if (!contact) throw new BillError(400, "That person must be one of your contacts");
      }

      const previousPayerId = share.payerId;
      await share.update(
        { payerId: newPayerId, status: "pending", declineNote: null, lastRemindedAt: null },
        { transaction: t }
      );
      return { bill, share, previousPayerId };
    });

    await safely("Reassign bill share", async () => {
      const { bill, share, previousPayerId } = outcome;
      const participants = [...(await participantIdsOf(models, bill)), previousPayerId];
      broadcastToBillParticipants(getIo(req), participants, bill.id, "bill_updated", {
        status: bill.status,
        shareId: share.id,
        shareStatus: share.status,
      });
      if (newPayerId !== userId) {
        const organizer = await models.User.findByPk(userId);
        await notifyBill(
          req,
          newPayerId,
          NotificationType.BILL_SHARE_ASSIGNED,
          bill,
          `${fullName(organizer)} assigned you a ${toNumber(share.amount)} ${bill.currency} share of "${bill.title}"`,
          { amount: toNumber(share.amount), currency: bill.currency, userName: fullName(organizer) }
        );
      }
    });

    res.status(200).json({ success: true, message: "Share reassigned" });
  } catch (error) {
    handleControllerError(res, error, "Reassign bill share");
  }
};

/** POST /bills/:id/shares/:shareId/close - organizer marks an unpaid share as settled outside the app. */
export const closeShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const outcome = await models.sequelize.transaction(async (t: DbTransaction) => {
      const bill = await loadBill(models, req.params.id, t);
      assertOpenBill(bill);
      assertOrganizer(bill, userId);
      const share = await loadShare(models, bill.id, req.params.shareId, t);
      if (!isOpenShare(share.status)) throw new BillError(400, `A ${share.status} share can't be closed out`);
      await share.update({ status: "closed", settledAt: new Date() }, { transaction: t });
      const completed = await completeIfSettled(models, bill, t);
      return { bill, share, completed };
    });

    await safely("Close bill share", async () => {
      const { bill, share, completed } = outcome;
      const participants = await participantIdsOf(models, bill);
      broadcastToBillParticipants(getIo(req), participants, bill.id, "bill_updated", {
        status: bill.status,
        shareId: share.id,
        shareStatus: share.status,
      });
      if (completed) await notifyCompleted(req, models, bill);
    });

    res.status(200).json({ success: true, message: "Share closed out", data: { completed: outcome.completed } });
  } catch (error) {
    handleControllerError(res, error, "Close bill share");
  }
};

/** POST /bills/:id/shares/:shareId/remind - organizer nudges someone who hasn't paid (max once an hour). */
export const remindShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const bill = await loadBill(models, req.params.id);
    assertOpenBill(bill);
    assertOrganizer(bill, userId);
    const share = await loadShare(models, bill.id, req.params.shareId);
    if (!isOpenShare(share.status)) throw new BillError(400, `A ${share.status} share can't be reminded`);

    if (share.lastRemindedAt && Date.now() - new Date(share.lastRemindedAt).getTime() < REMIND_COOLDOWN_MS) {
      throw new BillError(429, "You already sent a reminder recently. Try again in a while.");
    }

    await share.update({ lastRemindedAt: new Date() });

    const organizer = await models.User.findByPk(userId);
    await safely("Remind bill share", () =>
      notifyBill(
        req,
        share.payerId,
        NotificationType.BILL_REMINDER,
        bill,
        `${fullName(organizer)} is reminding you to pay your ${toNumber(share.amount)} ${bill.currency} share of "${bill.title}"`,
        { amount: toNumber(share.amount), currency: bill.currency, userName: fullName(organizer) }
      )
    );

    res.status(200).json({ success: true, message: "Reminder sent" });
  } catch (error) {
    handleControllerError(res, error, "Remind bill share");
  }
};

/**
 * POST /bills/:id/cancel
 * Only while nothing has been paid: money already sent to the recipient can't be pulled back,
 * so once any share is paid or covered the organizer closes out the rest instead.
 */
export const cancelBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const models = getModels(req);
    const userId = req.user.id;

    const outcome = await models.sequelize.transaction(async (t: DbTransaction) => {
      const bill = await loadBill(models, req.params.id, t);
      assertOpenBill(bill);
      assertOrganizer(bill, userId);

      const settledInApp = await models.BillShare.count({
        where: { billId: bill.id, status: { [Op.in]: SETTLED_IN_APP_STATUSES } },
        transaction: t,
      });
      if (settledInApp > 0) {
        throw new BillError(400, "Some shares are already paid - close out the remaining shares instead");
      }

      const openShares = await models.BillShare.findAll({
        where: { billId: bill.id, status: { [Op.in]: OPEN_SHARE_STATUSES } },
        transaction: t,
      });
      await models.BillShare.update(
        { status: "cancelled", settledAt: new Date() },
        { where: { billId: bill.id, status: { [Op.in]: OPEN_SHARE_STATUSES } }, transaction: t }
      );
      await bill.update({ status: "cancelled" }, { transaction: t });
      return { bill, payerIds: openShares.map((s) => s.payerId) };
    });

    await safely("Cancel bill", async () => {
      const { bill, payerIds } = outcome;
      const participants = await participantIdsOf(models, bill);
      broadcastToBillParticipants(getIo(req), participants, bill.id, "bill_updated", { status: bill.status });
      const organizer = await models.User.findByPk(userId);
      await Promise.all(
        payerIds
          .filter((id) => id !== userId)
          .map((payerId) =>
            notifyBill(
              req,
              payerId,
              NotificationType.BILL_CANCELLED,
              bill,
              `${fullName(organizer)} cancelled the split "${bill.title}"`
            )
          )
      );
    });

    res.status(200).json({ success: true, message: "Split cancelled" });
  } catch (error) {
    handleControllerError(res, error, "Cancel bill");
  }
};
