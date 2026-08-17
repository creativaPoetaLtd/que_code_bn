import { Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";

const { Wallet, Transaction: TransactionModel } = database_models as any;

/**
 * Reserves `amount` against the payer wallet's heldBalance. Does not move any money -
 * balance stays put, it's just no longer spendable (see utils/walletBalance.ts).
 */
export const holdEscrowFunds = async (
  payerWallet: any,
  amount: number,
  dbTransaction: DbTransaction
): Promise<void> => {
  const currentHeld = parseFloat(payerWallet.heldBalance.toString());
  await payerWallet.update({ heldBalance: currentHeld + amount }, { transaction: dbTransaction });
};

/**
 * Moves the held amount from payer to payee and writes the one ledger entry for the
 * escrow's whole lifetime. Locks both wallets - caller must already be inside a
 * sequelize managed transaction.
 */
export const releaseEscrowFunds = async (
  escrow: any,
  dbTransaction: DbTransaction
): Promise<{ transactionId: string }> => {
  const [payerWallet, payeeWallet] = await Promise.all([
    Wallet.findByPk(escrow.payerWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
    Wallet.findByPk(escrow.payeeWalletId, { lock: dbTransaction.LOCK.UPDATE, transaction: dbTransaction }),
  ]);
  if (!payerWallet) throw new Error("Escrow payer wallet not found");
  if (!payeeWallet) throw new Error("Escrow payee wallet not found");

  const amount = parseFloat(escrow.amount.toString());

  await payerWallet.update(
    {
      balance: parseFloat(payerWallet.balance.toString()) - amount,
      heldBalance: Math.max(0, parseFloat(payerWallet.heldBalance.toString()) - amount),
    },
    { transaction: dbTransaction }
  );
  await payeeWallet.update(
    { balance: parseFloat(payeeWallet.balance.toString()) + amount },
    { transaction: dbTransaction }
  );

  const releaseTransaction = await TransactionModel.create(
    {
      referenceId: `ESCROW-${escrow.id.substring(0, 8)}-${Date.now()}`,
      senderWalletId: payerWallet.id,
      receiverWalletId: payeeWallet.id,
      amount,
      fee: 0,
      totalAmount: amount,
      currency: escrow.currency,
      status: "completed",
      type: "transfer",
      description: escrow.description || "Escrow release",
      escrowId: escrow.id,
    } as any,
    { transaction: dbTransaction }
  );

  return { transactionId: releaseTransaction.id };
};

/**
 * Releases the hold back to the payer's spendable balance. Nothing ever left
 * payer.balance, so no ledger entry is needed - the Escrow row is the audit trail.
 */
export const refundEscrowFunds = async (escrow: any, dbTransaction: DbTransaction): Promise<void> => {
  const payerWallet = await Wallet.findByPk(escrow.payerWalletId, {
    lock: dbTransaction.LOCK.UPDATE,
    transaction: dbTransaction,
  });
  if (!payerWallet) throw new Error("Escrow payer wallet not found");

  const amount = parseFloat(escrow.amount.toString());
  const currentHeld = parseFloat(payerWallet.heldBalance.toString());
  await payerWallet.update(
    { heldBalance: Math.max(0, currentHeld - amount) },
    { transaction: dbTransaction }
  );
};
