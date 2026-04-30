import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
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
import {
  buildAccountPasswordSetupUrl,
  generateAccountSetupToken,
} from "../auth/reset_password";
import {
  notifyAccountVerified,
  notifyWelcome,
  notifyPasswordChanged,
  notifyWalletCreated,
} from "../utils/notificationHelpers";

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

    // Check if user already exists by email
    const existingUser = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      { where: { email: email.toLowerCase() } },
    );

    if (existingUser) {
      res.status(400).json({ message: "User with this email already exists" });
      return;
    }

    // Check if phone number already exists
    const existingPhone = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      { where: { phone: phone } },
    );

    if (existingPhone) {
      res
        .status(400)
        .json({ message: "User with this phone number already exists" });
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
      userData,
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
      profileData,
    );

    // Create wallet
    let walletCreated = false;
    let walletId: string | undefined;
    try {
      const walletData: WalletCreationAttributes = {
        userId: newUser.id,
        balance: 67000,
      };
      const newWallet = await insert_function("Wallet", "create", walletData);
      walletCreated = true;
      walletId = (newWallet as any).id;
    } catch (walletError) {
      console.error("❌ Error creating wallet for user:", walletError);
    }

    // Assign the default 'user' role to every new signup
    try {
      const userRole = await read_function<any>("Role", "findOne", {
        where: { name: "user" },
      });
      if (userRole) {
        await insert_function("UserRole", "create", {
          userId: newUser.id,
          roleId: (userRole as any).id,
        });
      }
    } catch (roleError) {
      console.error("❌ Failed to assign user role:", roleError);
      // Non-fatal — continue registration
    }

    // Generate verification token (2 days)
    const verificationToken = jwt.sign(
      { email: newUser.email, id: newUser.id },
      JWT_SECRET,
      { expiresIn: "2d", algorithm: "HS256" },
    );
    // Verification URL - point to frontend verification page
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/verify?token=${verificationToken}&otp=${otp}`;
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
        emailError.message,
      );
    }

    // Send welcome notification
    try {
      await notifyWelcome(req.app, newUser.id, `${firstName} ${lastName}`);
    } catch (notificationError) {
      console.error(
        "❌ Failed to send welcome notification:",
        notificationError,
      );
    }

    // Send wallet created notification
    if (walletCreated && walletId) {
      try {
        await notifyWalletCreated(req.app, newUser.id, walletId, "RWF");
      } catch (notificationError) {
        console.error(
          "❌ Failed to send wallet notification:",
          notificationError,
        );
      }
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
      error: error.message,
    });
  }
};

const verify_user_email = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const token =
      req.body.token ||
      (Array.isArray(req.query.token) ? req.query.token[0] : req.query.token);
    const otp =
      req.body.otp ||
      (Array.isArray(req.query.otp) ? req.query.otp[0] : req.query.otp);
    const email = req.body.email;

    if (!token && !email) {
      res
        .status(400)
        .json({ message: "Verification token or email is required" });
      return;
    }
    if (!otp) {
      res.status(400).json({ message: "OTP is required" });
      return;
    }

    let decoded: any = null;
    let user: UserModelAttributes | null = null;

    if (token) {
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

      user = await read_function<UserModelAttributes>("User", "findOne", {
        where: { id: decoded.id, email: decoded.email },
      });
    } else if (email) {
      user = await read_function<UserModelAttributes>("User", "findOne", {
        where: { email: email.toLowerCase() },
      });
    }

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
      { where: { id: plainUser.id } },
    );

    // Send account verified notification
    try {
      await notifyAccountVerified(
        req.app,
        plainUser.id,
        `${plainUser.firstName} ${plainUser.lastName}`,
      );
    } catch (notificationError) {
      console.error(
        "❌ Failed to send account verified notification:",
        notificationError,
      );
    }

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
  res: Response,
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
      { where: { id: user.id } },
    );

    const verificationToken = jwt.sign(
      { email: user.email, id: user.id },
      JWT_SECRET,
      { expiresIn: "30d", algorithm: "HS256" },
    );

    // Frontend verification page URL
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/verify?token=${verificationToken}&otp=${otp}`;

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
      "findAll",
    );
    const plainUsers = Array.isArray(allUsers)
      ? allUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u,
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
      include: [
        {
          model: database_models.Profile,
          as: "profile",
          attributes: ["profileImage"],
        },
      ],
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
    console.log(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the user", error });
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
      { where: { id: req.params.id } },
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
      { where: { id: req.params.id } },
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
      { where: { id: req.params.id } },
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
  res: Response,
): Promise<void> => {
  try {
    const approvedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      { where: { approvalStatus: true } },
    );
    const plainUsers = Array.isArray(approvedUsers)
      ? approvedUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u,
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
  res: Response,
): Promise<void> => {
  try {
    const unapprovedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      { where: { approvalStatus: false } },
    );
    const plainUsers = Array.isArray(unapprovedUsers)
      ? unapprovedUsers.map((u) =>
          isSequelizeInstance(u) ? u.get({ plain: true }) : u,
        )
      : [];
    res.status(200).json(plainUsers);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching all unapproved users",
    });
  }
};

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get all users with advanced pagination and filtering (Admin)
 */
const get_all_users_admin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClause: any = {};

    if (search) {
      const { Op } = require("sequelize");
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status === "verified") {
      whereClause.isVerified = true;
    } else if (status === "unverified") {
      whereClause.isVerified = false;
    } else if (status === "approved") {
      whereClause.approvalStatus = true;
    } else if (status === "pending") {
      whereClause.approvalStatus = false;
    }

    const users = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {
        where: whereClause,
        limit: Number(limit),
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: database_models.UserRole,
            as: "userRoles",
            include: [
              {
                model: database_models.Role,
                as: "role",
                attributes: ["id", "name", "description"],
              },
            ],
          },
        ],
      },
    );

    const allUsersForCount = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {
        where: whereClause,
      },
    );
    const totalCount = Array.isArray(allUsersForCount)
      ? allUsersForCount.length
      : 0;

    const plainUsers = Array.isArray(users)
      ? users.map((u: any) => {
          const plain = isSequelizeInstance(u) ? u.get({ plain: true }) : u;
          const { password, transactionPin, otp, pinResetOtp, ...safe } = plain;

          // Extract role from userRoles
          if (safe.userRoles && safe.userRoles.length > 0) {
            safe.role = safe.userRoles[0].role;
            delete safe.userRoles; // Remove the userRoles array, keep only role
          }

          return safe;
        })
      : [];

    res.status(200).json({
      success: true,
      data: plainUsers,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

/**
 * Get user statistics (Admin)
 */
const get_user_statistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const totalUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {},
    );
    const verifiedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {
        where: { isVerified: true },
      },
    );
    const approvedUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {
        where: { approvalStatus: true },
      },
    );
    const pendingUsers = await read_function<UserModelAttributes[]>(
      "User",
      "findAll",
      {
        where: { approvalStatus: false },
      },
    );

    const totalCount = Array.isArray(totalUsers) ? totalUsers.length : 0;
    const verifiedCount = Array.isArray(verifiedUsers)
      ? verifiedUsers.length
      : 0;
    const approvedCount = Array.isArray(approvedUsers)
      ? approvedUsers.length
      : 0;
    const pendingCount = Array.isArray(pendingUsers) ? pendingUsers.length : 0;

    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        verified: verifiedCount,
        approved: approvedCount,
        pending: pendingCount,
        unverified: totalCount - verifiedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
};

/**
 * Update user status (Admin)
 */
const update_user_status = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approvalStatus, isVerified } = req.body;

    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const updateData: any = {};
    if (typeof approvalStatus !== "undefined") {
      updateData.approvalStatus = approvalStatus;
    }
    if (typeof isVerified !== "undefined") {
      updateData.isVerified = isVerified;
    }

    await insert_function<UserModelAttributes>("User", "update", updateData, {
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
    });
  }
};

// Assign role to user (Admin only)
const assign_role_to_user = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      res.status(400).json({
        success: false,
        message: "userId and roleId are required",
      });
      return;
    }

    // Check if user exists
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check if role exists
    const role = await read_function("Role", "findOne", {
      where: { id: roleId },
    });

    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Check if user already has this role
    const existingUserRole = await read_function("UserRole", "findOne", {
      where: { userId, roleId },
    });

    if (existingUserRole) {
      res.status(400).json({
        success: false,
        message: "User already has this role",
      });
      return;
    }

    // Check if user already has a role assigned
    const currentUserRole = await read_function("UserRole", "findOne", {
      where: { userId },
    });

    if (currentUserRole) {
      // Update existing role assignment
      await insert_function(
        "UserRole",
        "update",
        { roleId },
        {
          where: { userId },
        },
      );
    } else {
      // Create new role assignment
      await insert_function("UserRole", "create", {
        userId,
        roleId,
      });
    }

    res.status(200).json({
      success: true,
      message: "Role assigned successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error assigning role to user",
      error: error.message,
    });
  }
};

// Admin creates a new user (auto-approved, sends password setup email)
const admin_create_user = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { firstName, lastName, phone, email, password, roleId } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !email) {
      res.status(400).json({
        message: "Missing required fields",
        required: ["firstName", "lastName", "phone", "email"],
      });
      return;
    }

    // Check if user already exists by email
    const existingUser = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      { where: { email: email.toLowerCase() } },
    );

    if (existingUser) {
      res.status(400).json({ message: "User with this email already exists" });
      return;
    }

    // Check if phone number already exists
    const existingPhone = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      { where: { phone: phone } },
    );

    if (existingPhone) {
      res
        .status(400)
        .json({ message: "User with this phone number already exists" });
      return;
    }

    // Generate password if not provided
    const userPassword =
      password || Math.random().toString(36).slice(-10) + "A1!";

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userPassword, saltRounds);

    // Create user (auto-approved by admin, no OTP needed)
    const userData: UserCreationAttributes = {
      firstName,
      lastName,
      phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      otp: "", // Not used for admin-created users (auto-verified)
      otpExpires: new Date(), // Not used for admin-created users (auto-verified)
      isVerified: true, // Auto-verified when created by admin
      approvalStatus: true, // Auto-approved when created by admin
    };

    const newUser = await insert_function<UserModelAttributes>(
      "User",
      "create",
      userData,
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
      profileData,
    );

    // Create wallet
    try {
      const walletData: WalletCreationAttributes = {
        userId: newUser.id,
        balance: 67000,
      };
      await insert_function("Wallet", "create", walletData);
    } catch (walletError) {
      console.error("❌ Error creating wallet for user:", walletError);
    }

    // Assign role if provided
    if (roleId) {
      try {
        await insert_function("UserRole", "create", {
          userId: newUser.id,
          roleId,
        });
      } catch (roleError) {
        console.error("❌ Error assigning role to user:", roleError);
      }
    }

    const passwordSetupToken = generateAccountSetupToken({
      id: newUser.id,
      email: email.toLowerCase(),
      accountType: "user",
      expiresIn: "7d",
    });
    const passwordSetupUrl = buildAccountPasswordSetupUrl(passwordSetupToken);

    // Send password setup email
    let emailSent = false;
    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: "Set Up Your QueCode Account Password",
        type: "password_reset",
        data: {
          name: `${firstName} ${lastName}`,
          email: email.toLowerCase(),
          title: "Set Your Password",
          message:
            "An administrator created your QueCode account. Use the secure link below to set your password and activate your account.",
          buttonText: "Set Password",
          resetUrl: passwordSetupUrl,
          expiryTime: "7 days",
        },
      });
      emailSent = true;
    } catch (emailError: any) {
      console.error(
        "❌ Failed to send password setup email:",
        emailError.message,
      );
    }

    const plainUser = isSequelizeInstance(newUser)
      ? newUser.get({ plain: true })
      : newUser;
    const { password: _, ...userWithoutPassword } = plainUser;

    const message = emailSent
      ? "User created successfully. A password setup email has been sent to the user."
      : "User created successfully. However, we couldn't send the password setup email. Ask the user to use forgot password to create their password.";

    res.status(201).json({
      message,
      data: userWithoutPassword,
      emailSent,
    });
  } catch (error: any) {
    console.error("❌ Admin user creation error:", error.message);
    res.status(500).json({
      message: "An error occurred while creating the user",
      error: error.message,
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
  // Admin functions
  get_all_users_admin,
  get_user_statistics,
  update_user_status,
  assign_role_to_user,
  admin_create_user,
};
