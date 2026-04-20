import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { insert_function } from "../utils/db_methods";
import { UserModelAttributes } from "../types/model";
import sendEmail from "../helpers/email.simple";
import Models from "../database/models";
import {
  buildAccessToken,
  createDeviceSession,
  extendDeviceSession,
  findActiveDeviceSession,
  getAccountForSession,
  revokeDeviceSession,
} from "../services/authSession.service";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const login_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Invalid email format" });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;

    const [user, organization] = await Promise.all([
      models.User.findOne({
        where: { email: email.toLowerCase() },
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
        include: [
          {
            model: models.UserRole,
            as: "userRoles",
            include: [
              {
                model: models.Role,
                as: "role",
                attributes: ["id", "name", "description"],
              },
            ],
          },
        ],
      }),
      models.Organization.findOne({
        where: { email: email.toLowerCase() },
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      }),
    ]);

    const account = user || organization;
    const accountType = user ? "user" : "organization";

    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    // Convert to plain object early
    const accountPlain: any = account.toJSON ? account.toJSON() : account;

    const isPasswordValid = await bcrypt.compare(
      password,
      accountPlain.password
    );
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (user && !user.isVerified) {
      try {
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
        await insert_function<UserModelAttributes>(
          "User",
          "update",
          { otp, otpExpires },
          { where: { id: accountPlain.id } }
        );
        const verificationToken = jwt.sign(
          { email: accountPlain.email, id: accountPlain.id },
          JWT_SECRET,
          { expiresIn: "2d", algorithm: "HS256" }
        );

        const verificationUrl = `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/auth/verify?token=${verificationToken}&otp=${otp}`;
        await sendEmail({
          to: accountPlain.email,
          subject: "Account Verification Required - New OTP Sent",
          type: "email_verification",
          data: {
            verificationUrl,
            name: `${accountPlain.firstName} ${accountPlain.lastName}`,
            otp,
          },
        });

        res.status(403).json({
          message:
            "Account not verified. A new verification email with OTP has been sent to your email address. Please verify your email before logging in.",
          requiresVerification: true,
          otpResent: true,
        });
        return;
      } catch (otpError: any) {
        res.status(403).json({
          message:
            "Account not verified. Please verify your email before logging in. Failed to resend verification email - please try again later.",
          requiresVerification: true,
          otpResent: false,
        });
        return;
      }
    }

    // Get clean user data with role - use get() with plain option
    const userPlain: any = user ? user.get({ plain: true }) : null;
    const orgPlain: any = organization
      ? organization.get({ plain: true })
      : null;
    const accountData = userPlain || orgPlain;

    const token = buildAccessToken(accountData, accountType);
    const { refreshToken, expiresAt: refreshExpiresAt } =
      await createDeviceSession(models, {
        accountId: accountData.id,
        accountType,
        userAgent: req.header("user-agent") || null,
        ipAddress: req.ip || null,
      });

    // Remove sensitive data
    const {
      password: _,
      transactionPin: __,
      pinResetOtp: ___,
      ...accountWithoutPassword
    } = accountData;

    // Extract role information for user accounts
    const roleData =
      userPlain && userPlain.userRoles?.[0]?.role
        ? {
            roleId: userPlain.userRoles[0].role.id,
            roleName: userPlain.userRoles[0].role.name,
            roleDescription: userPlain.userRoles[0].role.description,
          }
        : null;

    res.status(200).json({
      message: "Login successful",
      user: accountWithoutPassword,
      token,
      refreshToken,
      refreshExpiresAt,
      accountType,
      role: roleData,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred during login",
      error: error.message,
    });
  }
};

const refresh_session = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const session = await findActiveDeviceSession(models, refreshToken);

    if (!session) {
      res.status(401).json({ message: "Invalid or expired session" });
      return;
    }

    const account = await getAccountForSession(models, session);
    if (!account) {
      await session.update({ isActive: false, revokedAt: new Date() });
      res.status(401).json({ message: "Account not found" });
      return;
    }

    const accountData = account.get({ plain: true });
    const token = buildAccessToken(accountData, session.accountType);
    const refreshExpiresAt = await extendDeviceSession(session);

    res.status(200).json({
      message: "Session refreshed",
      token,
      refreshToken,
      refreshExpiresAt,
      accountType: session.accountType,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while refreshing the session",
      error: error.message,
    });
  }
};

const unlock_session = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, password } = req.body;

    if (!refreshToken || !password) {
      res
        .status(400)
        .json({ message: "Refresh token and password are required" });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const session = await findActiveDeviceSession(models, refreshToken);

    if (!session) {
      res.status(401).json({ message: "Invalid or expired session" });
      return;
    }

    const account = await getAccountForSession(models, session);
    if (!account) {
      await session.update({ isActive: false, revokedAt: new Date() });
      res.status(401).json({ message: "Account not found" });
      return;
    }

    const accountData = account.get({ plain: true });
    const isPasswordValid = await bcrypt.compare(password, accountData.password);

    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid password" });
      return;
    }

    await session.update({ lastUsedAt: new Date() });

    res.status(200).json({
      message: "App unlocked",
      token: buildAccessToken(accountData, session.accountType),
      accountType: session.accountType,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while unlocking the session",
      error: error.message,
    });
  }
};

const logout_session = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    await revokeDeviceSession(models, refreshToken);

    res.status(200).json({ message: "Session logged out" });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred during logout",
      error: error.message,
    });
  }
};

export default { login_user, refresh_session, unlock_session, logout_session };
