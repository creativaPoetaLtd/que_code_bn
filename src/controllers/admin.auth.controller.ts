// controllers/admin.auth.controller.ts
import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcrypt";
import database_models from "../database/config/db.config";

const { User, UserRole, Role, Permission, RolePermission } = database_models;

// Separate JWT secret for admin tokens
const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "admin_super_secret_key_CHANGE_THIS";
const ADMIN_TOKEN_EXPIRY: string | number =
  process.env.ADMIN_TOKEN_EXPIRY || "8h"; // Shorter expiry for security

/**
 * Admin login endpoint
 * Only allows users with admin or super_admin roles
 */
export const adminLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Find user with role information
    const user: any = await User.findOne({
      where: { email },
      include: [
        {
          model: UserRole,
          as: "userRoles",
          include: [
            {
              model: Role,
              as: "role",
              where: {
                name: ["admin", "super_admin"], // ONLY admin roles allowed
              },
              include: [
                {
                  model: RolePermission,
                  as: "rolePermissions",
                  include: [
                    {
                      model: Permission,
                      as: "permission",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // Check if user exists AND has admin role
    if (!user || !user.userRoles || user.userRoles.length === 0) {
      res.status(403).json({
        success: false,
        message: "Not authorized as administrator",
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Check if account is verified and approved
    if (!user.isVerified || !user.approvalStatus) {
      res.status(403).json({
        success: false,
        message: "Admin account is not verified or approved",
      });
      return;
    }

    // Get role and permissions
    const userRole = user.userRoles[0];
    const role = userRole.role;

    // Extract permissions
    const permissions = role.rolePermissions
      ? role.rolePermissions.map((rp: any) => rp.permission.name)
      : [];

    // Generate ADMIN token with admin-specific payload
    const tokenOptions: SignOptions = { expiresIn: ADMIN_TOKEN_EXPIRY as any };
    const adminToken = jwt.sign(
      {
        adminId: user.id,
        email: user.email,
        role: role.name,
        type: "admin", // CRITICAL: identifies this as admin token
        permissions,
      },
      ADMIN_JWT_SECRET,
      tokenOptions
    );

    // Prepare admin data (don't expose sensitive fields)
    const adminData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
      },
      permissions,
      isVerified: user.isVerified,
    };

    // Log admin login for audit
    console.log(
      `[ADMIN LOGIN] ${user.email} logged in at ${new Date().toISOString()}`
    );

    res.json({
      success: true,
      adminToken,
      admin: adminData,
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin authentication",
    });
  }
};

/**
 * Verify admin token
 * Requires admin middleware
 */
export const verifyAdminToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // req.admin is set by requireAdmin middleware
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
      return;
    }

    // Fetch fresh admin data from database
    const admin: any = await User.findByPk(req.admin.adminId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: UserRole,
          as: "userRoles",
          include: [
            {
              model: Role,
              as: "role",
              include: [
                {
                  model: RolePermission,
                  as: "rolePermissions",
                  include: [
                    {
                      model: Permission,
                      as: "permission",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!admin || !admin.userRoles || admin.userRoles.length === 0) {
      res.status(401).json({
        success: false,
        message: "Admin not found",
      });
      return;
    }

    const userRole = admin.userRoles[0];
    const role = userRole.role;
    const permissions = role.rolePermissions
      ? role.rolePermissions.map((rp: any) => rp.permission.name)
      : [];

    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
        },
        permissions,
        isVerified: admin.isVerified,
      },
    });
  } catch (error: any) {
    console.error("Admin verify error:", error);
    res.status(500).json({
      success: false,
      message: "Token verification failed",
    });
  }
};

/**
 * Admin logout
 * Just logs the action (token invalidation happens client-side)
 */
export const adminLogout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Log admin logout for audit
    if (req.admin) {
      console.log(
        `[ADMIN LOGOUT] ${
          req.admin.email
        } logged out at ${new Date().toISOString()}`
      );
    }

    res.json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error: any) {
    console.error("Admin logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export default {
  adminLogin,
  verifyAdminToken,
  adminLogout,
};
