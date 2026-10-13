import { Op } from "sequelize";

/**
 * Split-bill shaping for a wallet's transaction history.
 *
 * Each share of a split is its own transfer straight into the recipient's wallet, so on the
 * recipient's side one split would show up as N payments from N people. History folds those
 * into a single "Payment for <title>" row per split (the latest payment stands in for the group).
 *
 * A covered share is paid from someone else's wallet, so it would never appear in the payer's
 * own history. History pulls those transactions in and marks them as covered (no balance effect).
 */

const fullName = (user: any): string | null =>
  user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || null : null;

export interface SplitBillGroup {
  billId: string;
  title: string;
  status: string;
  currency: string;
  totalAmount: number;
  receivedAmount: number;
  paymentsCount: number;
  payments: {
    transactionId: string;
    payerName: string | null;
    paidByName: string | null;
    covered: boolean;
    amount: number;
    paidAt: Date;
  }[];
}

export interface CoveredShareInfo {
  billId: string;
  title: string;
  amount: number;
  coveredById: string | null;
  coveredByName: string | null;
}

export interface BillHistoryPlan {
  /** Incoming split payments folded into their group's representative row. */
  hiddenIds: string[];
  /** Payments someone else made for this wallet owner's share. */
  coveredIds: string[];
  groups: Map<string, SplitBillGroup>;
  covered: Map<string, CoveredShareInfo>;
}

export const buildBillHistoryPlan = async (
  models: any,
  wallet: { id: string; userId?: string | null },
  { groupIncoming }: { groupIncoming: boolean }
): Promise<BillHistoryPlan> => {
  const plan: BillHistoryPlan = { hiddenIds: [], coveredIds: [], groups: new Map(), covered: new Map() };

  if (groupIncoming) {
    const incoming = await models.Transaction.findAll({
      where: { receiverWalletId: wallet.id, billShareId: { [Op.ne]: null }, status: "completed" },
      attributes: ["id", "amount", "createdAt", "billShareId"],
      include: [
        {
          model: models.BillShare,
          as: "billShare",
          attributes: ["id", "billId", "status"],
          required: true,
          include: [
            { model: models.Bill, as: "bill", attributes: ["id", "title", "status", "currency", "totalAmount"] },
            { model: models.User, as: "payer", attributes: ["id", "firstName", "lastName"] },
            { model: models.User, as: "paidBy", attributes: ["id", "firstName", "lastName"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const byBill = new Map<string, any[]>();
    for (const tx of incoming) {
      const billId = tx.billShare.billId;
      if (!byBill.has(billId)) byBill.set(billId, []);
      byBill.get(billId)!.push(tx);
    }

    for (const [billId, txs] of byBill) {
      // Newest first, so the group sits where its latest payment landed.
      const [representative, ...rest] = txs;
      const bill = representative.billShare.bill;
      plan.hiddenIds.push(...rest.map((tx: any) => tx.id));
      plan.groups.set(representative.id, {
        billId,
        title: bill?.title || "Split bill",
        status: bill?.status || "open",
        currency: bill?.currency || "RWF",
        totalAmount: Number(bill?.totalAmount || 0),
        receivedAmount: txs.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0),
        paymentsCount: txs.length,
        payments: txs.map((tx: any) => ({
          transactionId: tx.id,
          payerName: fullName(tx.billShare.payer),
          paidByName: fullName(tx.billShare.paidBy),
          covered: tx.billShare.status === "covered",
          amount: Number(tx.amount),
          paidAt: tx.createdAt,
        })),
      });
    }
  }

  if (wallet.userId) {
    const coveredShares = await models.BillShare.findAll({
      where: { payerId: wallet.userId, status: "covered", transactionId: { [Op.ne]: null } },
      attributes: ["id", "billId", "amount", "transactionId", "paidByUserId"],
      include: [
        { model: models.Bill, as: "bill", attributes: ["id", "title"] },
        { model: models.User, as: "paidBy", attributes: ["id", "firstName", "lastName"] },
      ],
    });
    for (const share of coveredShares) {
      plan.coveredIds.push(share.transactionId);
      plan.covered.set(share.transactionId, {
        billId: share.billId,
        title: share.bill?.title || "Split bill",
        amount: Number(share.amount),
        coveredById: share.paidByUserId || null,
        coveredByName: fullName(share.paidBy),
      });
    }
  }

  return plan;
};

/** Applies the plan to one serialized history row. */
export const shapeBillHistoryRow = (row: any, plan: BillHistoryPlan): any => {
  const group = plan.groups.get(row.id);
  if (group) {
    return {
      ...row,
      amount: group.receivedAmount,
      fee: 0,
      totalAmount: group.receivedAmount,
      description: `Payment for ${group.title}`,
      // No single sender: the row stands for everyone who paid into the split.
      senderWallet: null,
      senderWalletId: null,
      splitBill: group,
    };
  }
  const covered = plan.covered.get(row.id);
  if (covered) {
    return {
      ...row,
      description: `Your share of "${covered.title}" was covered by ${covered.coveredByName || "someone"}`,
      coveredShare: covered,
    };
  }
  return row;
};
