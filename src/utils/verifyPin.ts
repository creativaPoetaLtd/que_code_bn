import * as bcrypt from "bcrypt";
import database_models from "../database/config/db.config";

const { User } = database_models as any;

/**
 * Thrown by verifyTransactionPin - callers should map `status`/`message` onto their
 * own HTTP response the same way escrowController's ControllerError is handled.
 */
export class PinVerificationError extends Error {
  status: number;
  requiresPinSetup?: boolean;
  constructor(status: number, message: string, requiresPinSetup?: boolean) {
    super(message);
    this.status = status;
    this.requiresPinSetup = requiresPinSetup;
  }
}

/**
 * Shared PIN check for money-moving actions (3-attempt lockout, 15 minutes).
 * Extracted from escrowController's verifyPin so new money features don't
 * reimplement PIN verification with a different lockout policy.
 */
export const verifyTransactionPin = async (userId: string, pin: string): Promise<void> => {
  const user = await User.findByPk(userId);
  if (!user) throw new PinVerificationError(404, "Authenticated user not found");
  if (!user.hasPinSet) {
    throw new PinVerificationError(403, "PIN not set up. Please set up your transaction PIN first.", true);
  }
  if (!pin) throw new PinVerificationError(400, "PIN is required");
  if (!/^\d{4}$/.test(pin)) throw new PinVerificationError(400, "PIN must be exactly 4 digits");

  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000);
    throw new PinVerificationError(429, `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`);
  }

  const isValid = await bcrypt.compare(pin, user.transactionPin!);
  if (!isValid) {
    const attempts = (user.pinAttempts || 0) + 1;
    const maxAttempts = 3;
    if (attempts >= maxAttempts) {
      await user.update({ pinAttempts: attempts, pinLockedUntil: new Date(Date.now() + 15 * 60000) });
      throw new PinVerificationError(429, "Account locked due to too many failed PIN attempts. Please reset your PIN.");
    }
    await user.update({ pinAttempts: attempts });
    throw new PinVerificationError(400, `Invalid PIN. ${maxAttempts - attempts} attempts remaining.`);
  }

  await user.update({ pinAttempts: 0, pinLockedUntil: null });
};
