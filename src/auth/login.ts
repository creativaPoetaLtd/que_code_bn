import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { read_function } from "../utils/db_methods";
import {
  UserModelAttributes,
  OrganizationModelAttributes,
} from "../types/model";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const login_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt started");
    console.log("📧 Email:", email);

    // Validate input
    if (!email || !password) {
      console.log("❌ Missing email or password");
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Invalid email format");
      res.status(400).json({ message: "Invalid email format" });
      return;
    }

    console.log("🔍 Searching for account in database...");

    // Check both tables simultaneously
    const [user, organization] = await Promise.all([
      read_function<UserModelAttributes>("User", "findOne", {
        where: { email: email.toLowerCase() },
        attributes: {
          exclude: ["createdAt", "updatedAt"], // Exclude unnecessary fields
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
      console.log("❌ Account not found");
      res.status(404).json({ message: "Account not found" });
      return;
    }

    console.log(`✅ Account found: ${accountType}`);
    console.log(`👤 Account ID: ${account.id}`);

    // Check password
    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password");
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    console.log("✅ Password validated");

    // Check email verification for users only
    if (user && !user.isVerified) {
      console.log("❌ User email not verified");
      res.status(403).json({
        message:
          "Account not verified. Please verify your email before logging in.",
        requiresVerification: true,
      });
      return;
    }

    console.log("✅ Account verification status checked");

    // Generate JWT token
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

    console.log("✅ JWT token generated");

    // Remove password from response
    const { password: _, ...accountWithoutPassword } = account;

    console.log("🎉 Login successful");

    res.status(200).json({
      message: "Login successful",
      user: accountWithoutPassword,
      token,
      accountType,
    });
  } catch (error: any) {
    console.error("❌ Login error:", error.message);
    console.error("❌ Full error:", error);
    res.status(500).json({
      message: "An error occurred during login",
      error: error.message,
    });
  }
};

export default { login_user };
