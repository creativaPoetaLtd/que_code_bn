import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import {
  UserCreationAttributes,
  UserModelAttributes,
  WalletCreationAttributes,
  ProfileCreationAttributes,
  ProfileModelAttributes,
} from "../types/model";
import bcrypt from "bcrypt";
import sendEmail from "../helpers/email.simple";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

// Generate a 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register a new user
const create_user = async (req: Request, res: Response): Promise<void> => {
  try {

    const { firstName, lastName, phone, email, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !email || !password) {
      res.status(400).json({
        message: "Missing required fields",
        required: ["firstName", "lastName", "phone", "email", "password"],
      });
      return;
    }

    // Check if user already exists
    const existingUser = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      { where: { email: email.toLowerCase() } }
    );

    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("✅ Password hashed successfully");

    // Generate OTP and set expiration (10 minutes)
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    // Create user
    const userData: UserCreationAttributes = {
      firstName,
      lastName,
      phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      otp,
      otpExpires,
    };

    console.log("📝 Creating user with data:", {
      ...userData,
      password: "[HASHED]",
      otp: "[HIDDEN]",
    });

    const newUser = await insert_function<UserModelAttributes>(
      "User",
      "create",
      userData
    );
    // Generate QR Code for user profile
    const userProfileLink = `${process.env.FRONTEND_URL}/welcome/${newUser.id}`;
    const qrCodeData = await QRCode.toDataURL(userProfileLink);

    // Create profile
    const profileData: ProfileCreationAttributes = {
      type: "individual",
      userId: newUser.id,
      qrCode: qrCodeData,
    };
    await insert_function<ProfileModelAttributes>(
      "Profile",
      "create",
      profileData
    );

    // Create wallet
    try {
      const walletData: WalletCreationAttributes = {
        userId: newUser.id,
      };
      await insert_function("Wallet", "create", walletData);
    } catch (walletError) {
      console.error("❌ Error creating wallet for user:", walletError);
    }

    // Generate verification token (2 days)
    const verificationToken = jwt.sign(
      { email: newUser.email, id: newUser.id },
      JWT_SECRET,
      { expiresIn: "2d", algorithm: "HS256" }
    );
    // Verification URL
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/verify?token=${verificationToken}&otp=${otp}`; // In
    // Send verification email with OTP
    let emailSent = false;
    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: "Email Verification Required - Complete Your Registration",
        type: "email_verification",
        data: {
          verificationUrl,
          name: `${firstName} ${lastName}`,
          otp,
        },
      });
      emailSent = true;
    } catch (emailError: any) {
      console.error(
        "❌ Failed to send verification email:",
        emailError.message
      );
    }

    const plainUser = isSequelizeInstance(newUser)
      ? newUser.get({ plain: true })
      : newUser;
    const {
      password: _,
      otp: __,
      otpExpires: ___,
      ...userWithoutSensitive
    } = plainUser;

    const message = emailSent
      ? "User registered successfully. Please check your email for verification instructions and OTP."
      : "User registered successfully. However, we couldn't send the verification email. Please contact support.";

    res.status(201).json({
      message,
      data: userWithoutSensitive,
      emailSent,
    });
  } catch (error: any) {
    console.error("❌ User registration error:", error.message);
    console.error("❌ Full error:", error);
    res.status(500).json({
      message: "An error occurred while registering the user",
      error: error.megssage,
    });
  }
};

const verify_user_email = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const token = Array.isArray(req.query.token)
      ? req.query.token[0]
      : req.query.token;
    const otp = Array.isArray(req.query.otp) ? req.query.otp[0] : req.query.otp;

    // Validate inputs
    if (!token) {
      res.status(400).json({ message: "Verification token is required" });
      return;
    }
    if (!otp) {
      res.status(400).json({ message: "OTP is required" });
      return;
    }

    // Verify and decode the token
    let decoded: any;
    try {
      decoded = jwt.verify(String(token), JWT_SECRET);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        res.status(400).json({ message: "Verification token has expired" });
      } else {
        res.status(400).json({ message: "Invalid verification token" });
      }
      return;
    }

    // Find the user
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: decoded.id, email: decoded.email },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const plainUser = isSequelizeInstance(user)
      ? user.get({ plain: true })
      : user;


    // Already verified?
    if (plainUser.isVerified) {
      res.status(200).json({
        message: "User is already verified",
        verified: true,
      });
      return;
    }

    // Check OTP expiry first
    if (plainUser.otpExpires && new Date() > new Date(plainUser.otpExpires)) {
      res.status(400).json({ message: "OTP has expired" });
      return;
    }

    // Then check OTP match
    if (plainUser.otp !== otp) {
      res.status(400).json({ message: "Invalid OTP" });
      return;
    }

    // Update verification status
    await insert_function<UserModelAttributes>(
      "User",
      "update",
      {
        isVerified: true,
        otp: null,
        otpExpires: null,
      },
      { where: { id: decoded.id } }
    );

    res.status(200).json({
      message: "User verified successfully! You can now log in.",
      verified: true,
    });
  } catch (error: any) {
    console.error("❌ User verification error:", error.message);
    res.status(500).json({
      message: "An error occurred while verifying the user",
      error: error.message,
    });
  }
};

// filepath: /Users/izanyibukayvette/Desktop/WORK/CREATIVA/que_code_bn/src/controllers/userController.ts
const resend_verification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.isVerified) {
      res.status(200).json({ message: "User is already verified" });
      return;
    }

    // Generate new OTP and token
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await insert_function<UserModelAttributes>(
      "User",
      "update",
      { otp, otpExpires },
      { where: { id: user.id } }
    );

    const verificationToken = jwt.sign(
      { email: user.email, id: user.id },
      JWT_SECRET,
      { expiresIn: "30d", algorithm: "HS256" }
    );

    // ✅ Fix path: use /verify instead of /auth/verify
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/verify?token=${verificationToken}&otp=${otp}`;

    await sendEmail({
      to: user.email,
      subject: "Resend Email Verification",
      type: "email_verification",
      data: {
        verificationUrl,
        name: `${user.firstName} ${user.lastName}`,
        otp,
      },
    });

    res.status(200).json({ message: "Verification email resent successfully" });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to resend verification email",
      error: error.message,
    });
  }
};

// Other endpoints (unchanged)
const get_all_users = async (req: Request, res: Response): Promise<void> => {
  try {
    const allUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll"
    );
    const plainUsers = Array.isArray(allUsers)
      ? allUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u
        )
      : [];
    res.status(200).json(plainUsers);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while fetching all users" });
  }
};

const get_user_by_id = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const plainUser = isSequelizeInstance(user)
      ? user.get({ plain: true })
      : user;
    res.status(200).json(plainUser);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while fetching the user" });
  }
};

const update_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const updateData: Partial<UserModelAttributes> = {
      ...req.body,
    };

    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    const updatedUser = await insert_function<UserModelAttributes>(
      "User",
      "update",
      updateData,
      { where: { id: req.params.id } }
    );

    const plainUser = isSequelizeInstance(updatedUser)
      ? updatedUser.get({ plain: true })
      : updatedUser;
    res.status(200).json(plainUser);
  } catch (error) {
    console.error("Error in update_user:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the user" });
  }
};

const delete_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await read_function<UserModelAttributes>("User", "destroy", {
      where: { id: req.params.id },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while deleting the user" });
  }
};

const approve_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const approvedUser = await insert_function<UserModelAttributes>(
      "User",
      "update",
      { approvalStatus: true },
      { where: { id: req.params.id } }
    );

    const plainUser = isSequelizeInstance(approvedUser)
      ? approvedUser.get({ plain: true })
      : approvedUser;
    res.status(200).json(plainUser);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while approving the user" });
  }
};

const disapprove_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const disapprovedUser = await insert_function<UserModelAttributes>(
      "User",
      "update",
      { approvalStatus: false },
      { where: { id: req.params.id } }
    );

    const plainUser = isSequelizeInstance(disapprovedUser)
      ? disapprovedUser.get({ plain: true })
      : disapprovedUser;
    res.status(200).json(plainUser);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while disapproving the user" });
  }
};

const get_approved_users = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const approvedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      { where: { approvalStatus: true } }
    );
    const plainUsers = Array.isArray(approvedUsers)
      ? approvedUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u
        )
      : [];
    res.status(200).json(plainUsers);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while fetching all approved users" });
  }
};

const get_unapproved_users = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const unapprovedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      { where: { approvalStatus: false } }
    );
    const plainUsers = Array.isArray(unapprovedUsers)
      ? unapprovedUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u
        )
      : [];
    res.status(200).json(plainUsers);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching all unapproved users",
    });
  }
};

export default {
  create_user,
  verify_user_email,
  resend_verification,
  get_all_users,
  get_user_by_id,
  update_user,
  delete_user,
  approve_user,
  disapprove_user,
  get_approved_users,
  get_unapproved_users,
};
