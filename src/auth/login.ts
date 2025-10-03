import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { read_function, insert_function } from "../utils/db_methods";
import {
  UserModelAttributes,
  OrganizationModelAttributes,
} from "../types/model";
import sendEmail from "../helpers/email.simple";

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

    const [user, organization] = await Promise.all([
      read_function<UserModelAttributes>("User", "findOne", {
        where: { email: email.toLowerCase() },
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      }),
      read_function<OrganizationModelAttributes>("Organization", "findOne", {
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
    const isPasswordValid = await bcrypt.compare(password, account.password);
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
          { where: { id: user.id } }
        );
        const verificationToken = jwt.sign(
          { email: user.email, id: user.id },
          JWT_SECRET,
          { expiresIn: "2d", algorithm: "HS256" }
        );

        const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"
          }/auth/verify?token=${verificationToken}&otp=${otp}`;
        await sendEmail({
          to: user.email,
          subject: "Account Verification Required - New OTP Sent",
          type: "email_verification",
          data: {
            verificationUrl,
            name: `${user.firstName} ${user.lastName}`,
            otp,
          },
        });

        res.status(403).json({
          message: "Account not verified. A new verification email with OTP has been sent to your email address. Please verify your email before logging in.",
          requiresVerification: true,
          otpResent: true,
        });
        return;
      } catch (otpError: any) {
        res.status(403).json({
          message: "Account not verified. Please verify your email before logging in. Failed to resend verification email - please try again later.",
          requiresVerification: true,
          otpResent: false,
        });
        return;
      }
    }

    const tokenPayload = {
      id: account.id,
      email: account.email,
      name: user ? `${user.firstName} ${user.lastName}` : organization?.name,
      accountType: accountType,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "1d",
      algorithm: "HS256",
    });
    const { password: _, ...accountWithoutPassword } = account;


    res.status(200).json({
      message: "Login successful",
      user: accountWithoutPassword,
      token,
      accountType,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred during login",
      error: error.message,
    });
  }
};

export default { login_user };
