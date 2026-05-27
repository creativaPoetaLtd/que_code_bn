import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { read_function, update_function } from "../utils/db_methods";
import {
  OrganizationModelAttributes,
  UserModelAttributes,
} from "../types/model";
import sendEmail from "../helpers/email.simple";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NON_ADMIN_FRONTEND_URL =
  process.env.NON_ADMIN_FRONTEND_URL || "https://qc-dev2.netlify.app";

type PasswordResetAccountType = "user" | "organization";
type AuthTokenPurpose = "password_reset" | "account_setup";

interface PasswordResetTokenPayload {
  id: string;
  email: string;
  accountType: PasswordResetAccountType;
  purpose: AuthTokenPurpose;
}

export const generatePasswordResetToken = ({
  id,
  email,
  accountType,
  expiresIn = "1h",
}: {
  id: string;
  email: string;
  accountType: PasswordResetAccountType;
  expiresIn?: "1h" | "7d";
}): string => {
  const payload: PasswordResetTokenPayload = {
    id,
    email,
    accountType,
    purpose: "password_reset",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: "HS256",
  });
};

export const generateAccountSetupToken = ({
  id,
  email,
  accountType,
  expiresIn = "7d",
}: {
  id: string;
  email: string;
  accountType: PasswordResetAccountType;
  expiresIn?: "1h" | "7d";
}): string => {
  const payload: PasswordResetTokenPayload = {
    id,
    email,
    accountType,
    purpose: "account_setup",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: "HS256",
  });
};

export const buildPasswordResetUrl = (token: string): string =>
  `${FRONTEND_URL}/auth/reset-password/${token}`;

export const buildAccountPasswordSetupUrl = (token: string): string =>
  `${NON_ADMIN_FRONTEND_URL}/auth/set-account-password?token=${encodeURIComponent(token)}`;

const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const normalizedEmail = email.toLowerCase();

    const [user, organization] = await Promise.all([
      read_function<UserModelAttributes>("User", "findOne", {
        where: { email: normalizedEmail },
      }),
      read_function<OrganizationModelAttributes>("Organization", "findOne", {
        where: { email: normalizedEmail },
      }),
    ]);

    const account = user || organization;
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    const isUserAccount = Boolean(user);
    const plainAccount =
      account && typeof (account as any).get === "function"
        ? (account as any).get({ plain: true })
        : account;

    const resetToken = generatePasswordResetToken({
      id: plainAccount.id,
      email: plainAccount.email,
      accountType: isUserAccount ? "user" : "organization",
    });
    const resetUrl = buildPasswordResetUrl(resetToken);

    await sendEmail({
      to: isUserAccount ? plainAccount.email : plainAccount.ownerEmail,
      subject: "Reset Your QueCode Password",
      type: "password_reset",
      data: {
        title: "Reset Your Password",
        name: isUserAccount
          ? `${plainAccount.firstName} ${plainAccount.lastName}`
          : plainAccount.ownerName || plainAccount.name,
        email: plainAccount.email,
        message:
          "We received a request to reset your password. Use the secure link below to choose a new one.",
        buttonText: "Reset Password",
        resetUrl,
        expiryTime: "1 hour",
      },
    });

    res.status(200).json({ message: "Reset email sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res
      .status(500)
      .json({ message: "An error occurred while requesting password reset" });
  }
};
const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ message: "Token and new password are required" });
      return;
    }

    let decoded: PasswordResetTokenPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as PasswordResetTokenPayload;
    } catch (jwtError) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    if (decoded.purpose !== "password_reset") {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const modelName =
      decoded.accountType === "organization" ? "Organization" : "User";
    const account = await read_function<any>(modelName, "findOne", {
      where: { id: decoded.id, email: decoded.email },
    });

    if (!account) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await update_function(
      modelName as any,
      "update",
      {
        password: hashedPassword,
      },
      { where: { id: decoded.id } },
    );

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res
      .status(500)
      .json({ message: "An error occurred while resetting password" });
  }
};

const setAccountPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ message: "Token and new password are required" });
      return;
    }

    let decoded: PasswordResetTokenPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as PasswordResetTokenPayload;
    } catch (jwtError) {
      res.status(400).json({ message: "Invalid or expired setup token" });
      return;
    }

    if (decoded.purpose !== "account_setup") {
      res.status(400).json({ message: "Invalid or expired setup token" });
      return;
    }

    const modelName =
      decoded.accountType === "organization" ? "Organization" : "User";
    const account = await read_function<any>(modelName, "findOne", {
      where: { id: decoded.id, email: decoded.email },
    });

    if (!account) {
      res.status(400).json({ message: "Invalid or expired setup token" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await update_function(
      modelName as any,
      "update",
      {
        password: hashedPassword,
      },
      { where: { id: decoded.id } },
    );

    res.status(200).json({ message: "Account password set successfully" });
  } catch (error) {
    console.error("Set account password error:", error);
    res
      .status(500)
      .json({ message: "An error occurred while setting account password" });
  }
};

export default { forgotPassword, resetPassword, setAccountPassword };
