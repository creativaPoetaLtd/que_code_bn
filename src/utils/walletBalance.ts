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
