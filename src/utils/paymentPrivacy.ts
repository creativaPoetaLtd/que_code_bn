// Redacts payer identity on anonymous contributions before a payment list
// leaves the server. Money and totals are never touched — only the `payer`/
// `payerId` fields are hidden from viewers who aren't the payer themselves
// or a privileged viewer (campaign creator / group owner-admin).
export const redactAnonymousPayments = <T extends Record<string, any>>(
  payments: T[],
  viewerId: string | undefined,
  viewerIsPrivileged: boolean
): T[] => {
  return payments.map((payment) => {
    const plain: any = typeof payment.toJSON === "function" ? payment.toJSON() : payment;

    if (!plain.isAnonymous || plain.payerId === viewerId || viewerIsPrivileged) {
      return plain;
    }

    return {
      ...plain,
      payerId: null,
      payer: { id: null, firstName: "Anonymous", lastName: "" },
    };
  });
};
