import { Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { getAvailableBalance } from "../utils/walletBalance";

const { Wallet, Transaction: TransactionModel } = database_models as any;

/**
 * Moves `amount` from a shared wallet's pooled Wallet into a member's personal wallet
 * and writes the one ledger entry for it. Locks both wallets - caller must already be
 * inside a sequelize managed transaction. Used by both free-mode withdrawals (immediate)
 * and approval-mode withdrawals (once the required number of approvals is reached) -
 * `sharedWalletWithdrawalId` is only set for the latter.
 */
export const executeSharedWalletWithdrawal = async (
  sharedWalletWalletId: string,
  memberWalletId: string,
  amount: number,
  description: string,
  dbTransaction: DbTransaction,
  sharedWalletWithdrawalId: string | null = null
): Promise<{ transactionId: string; referenceId: string }> => {
  const [pooledWallet, memberWallet] = await Promise.all([
    Wallet.findByPk(sharedWalletWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
    Wallet.findByPk(memberWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
  ]);
  if (!pooledWallet) throw new Error("Shared wallet not found");
  if (!memberWallet) throw new Error("Member wallet not found");

  if (getAvailableBalance(pooledWallet) < amount) {
    throw new Error(
      `Insufficient shared wallet balance. Available: ${getAvailableBalance(pooledWallet)} ${pooledWallet.currency}, requested: ${amount}`
    );
  }

  await pooledWallet.update(
    { balance: parseFloat(pooledWallet.balance.toString()) - amount },
    { transaction: dbTransaction }
  );
  await memberWallet.update(
    { balance: parseFloat(memberWallet.balance.toString()) + amount },
    { transaction: dbTransaction }
  );

  const referenceId = `SWW-${(sharedWalletWithdrawalId || sharedWalletWalletId).substring(0, 8)}-${Date.now()}`;
  const transaction = await TransactionModel.create(
    {
      referenceId,
      senderWalletId: pooledWallet.id,
      receiverWalletId: memberWallet.id,
      amount,
      fee: 0,
      totalAmount: amount,
      currency: pooledWallet.currency || "RWF",
      status: "completed",
      type: "withdrawal",
      description,
      sharedWalletWithdrawalId,
    } as any,
    { transaction: dbTransaction }
  );

  return { transactionId: transaction.id, referenceId };
};

/**
 * Moves `amount` from a member's personal wallet into a shared wallet's pooled Wallet.
 * Symmetric to executeSharedWalletWithdrawal above. Any active member can deposit -
 * there's no approval step for putting money in, only for taking it out.
 */
export const depositIntoSharedWallet = async (
  sharedWalletId: string,
  sharedWalletWalletId: string,
  fromMemberWalletId: string,
  amount: number,
  description: string,
  dbTransaction: DbTransaction
): Promise<{ transactionId: string; referenceId: string }> => {
  const [pooledWallet, memberWallet] = await Promise.all([
    Wallet.findByPk(sharedWalletWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
    Wallet.findByPk(fromMemberWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
  ]);
  if (!pooledWallet) throw new Error("Shared wallet not found");
  if (!memberWallet) throw new Error("Member wallet not found");

  if (getAvailableBalance(memberWallet) < amount) {
    throw new Error(
      `Insufficient balance. Available: ${getAvailableBalance(memberWallet)} ${memberWallet.currency}, requested: ${amount}`
    );
  }

  await memberWallet.update(
    { balance: parseFloat(memberWallet.balance.toString()) - amount },
    { transaction: dbTransaction }
  );
  await pooledWallet.update(
    { balance: parseFloat(pooledWallet.balance.toString()) + amount },
    { transaction: dbTransaction }
  );

  const referenceId = `SWD-${sharedWalletId.substring(0, 8)}-${Date.now()}`;
  const transaction = await TransactionModel.create(
    {
      referenceId,
      senderWalletId: memberWallet.id,
      receiverWalletId: pooledWallet.id,
      amount,
      fee: 0,
      totalAmount: amount,
      currency: pooledWallet.currency || "RWF",
      status: "completed",
      type: "transfer",
      description,
    } as any,
    { transaction: dbTransaction }
  );

  return { transactionId: transaction.id, referenceId };
};
