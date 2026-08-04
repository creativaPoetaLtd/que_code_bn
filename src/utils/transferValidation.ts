// Shared, side-effect-free helpers for validating a wallet-to-wallet transfer.
// Used by both the live transfer endpoint's fund-hold equivalent and scheduled transfers,
// so the "can this wallet afford this send" rule only lives in one place.

export interface WalletRestrictionLike {
  categoryId: string;
  amount: number | string;
  category?: { name?: string };
}

export interface FundsAvailabilityResult {
  ok: boolean;
  message?: string;
  availableUnrestrictedAmount: number;
  restrictedAvailable?: number;
  allowedCategories?: {
    categoryId: string;
    categoryName?: string;
    availableAmount: number;
  }[];
}

export const validateFundsAvailability = (params: {
  availableBalance: number;
  restrictions: WalletRestrictionLike[];
  transferAmount: number;
  receiverIsUser: boolean;
  categoryId?: string | null;
}): FundsAvailabilityResult => {
  const { availableBalance, restrictions, transferAmount, receiverIsUser, categoryId } = params;

  const totalRestrictedAmount = restrictions.reduce(
    (sum, r) => sum + parseFloat(r.amount.toString()),
    0
  );
  const availableUnrestrictedAmount = Math.max(0, availableBalance - totalRestrictedAmount);

  const allowedCategories = () =>
    restrictions.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      availableAmount: parseFloat(r.amount.toString()),
    }));

  // Sending to an individual user can only draw on unrestricted funds.
  if (receiverIsUser) {
    if (availableUnrestrictedAmount < transferAmount) {
      return {
        ok: false,
        message: `Insufficient unrestricted balance for transfer to a user. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
        availableUnrestrictedAmount,
      };
    }
    return { ok: true, availableUnrestrictedAmount };
  }

  if (categoryId) {
    const matching = restrictions.find((r) => r.categoryId === categoryId);
    if (matching) {
      const restrictedAvailable = parseFloat(matching.amount.toString());
      if (restrictedAvailable < transferAmount) {
        const remainderNeeded = transferAmount - restrictedAvailable;
        if (availableUnrestrictedAmount < remainderNeeded) {
          return {
            ok: false,
            message: `Insufficient funds. Restricted available: ${restrictedAvailable}, Unrestricted available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
            availableUnrestrictedAmount,
            restrictedAvailable,
          };
        }
      }
      return { ok: true, availableUnrestrictedAmount, restrictedAvailable };
    }

    if (availableUnrestrictedAmount < transferAmount) {
      return {
        ok: false,
        message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
        availableUnrestrictedAmount,
        allowedCategories: allowedCategories(),
      };
    }
    return { ok: true, availableUnrestrictedAmount };
  }

  if (availableUnrestrictedAmount < transferAmount) {
    return {
      ok: false,
      message: `Insufficient unrestricted balance. Available: ${availableUnrestrictedAmount}, Required: ${transferAmount}`,
      availableUnrestrictedAmount,
      allowedCategories: allowedCategories(),
    };
  }
  return { ok: true, availableUnrestrictedAmount };
};

export const resolveWalletWhere = (identity: {
  userId?: string | null;
  organizationId?: string | null;
  subActionId?: string | null;
  walletId?: string | null;
}): Record<string, unknown> | null => {
  if (identity.userId) return { userId: identity.userId, isActive: true };
  if (identity.organizationId) return { organizationId: identity.organizationId, isActive: true };
  if (identity.subActionId) return { subActionId: identity.subActionId, isActive: true };
  if (identity.walletId) return { id: identity.walletId, isActive: true };
  return null;
};
