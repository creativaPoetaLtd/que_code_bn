// Spendable balance always excludes funds reserved by scheduled transfers.
// Never read wallet.balance directly for a "can this be spent" check.

interface WalletBalanceLike {
  balance: number | string;
  heldBalance: number | string;
}

export const getAvailableBalance = (wallet: WalletBalanceLike): number => {
  const balance = parseFloat(wallet.balance.toString());
  const held = parseFloat((wallet.heldBalance ?? 0).toString());
  return Math.max(0, balance - held);
};

// Opening balance for wallets created at signup. 0 by default - money enters through a
// top-up. A test environment can set SIGNUP_WALLET_BALANCE to seed new accounts.
export const initialWalletBalance = (): number => {
  const value = Number(process.env.SIGNUP_WALLET_BALANCE);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
