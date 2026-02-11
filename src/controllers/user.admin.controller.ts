import { Response } from "express";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";

const { User, UserRole, Role, RolePermission, Permission } = database_models;

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClause: any = {};

    if (search) {
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

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: {
        exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
      },
      include: [
        {
          model: UserRole,
          as: "userRoles",
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "name", "description"],
            },
          ],
        },
      ],
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
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
 * Get user by ID
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: {
        exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
      },
      include: [
        {
          model: UserRole,
          as: "userRoles",
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["id", "name", "description"],
              include: [
                {
                  model: RolePermission,
                  as: "rolePermissions",
                  include: [
                    {
                      model: Permission,
                      as: "permission",
                      attributes: ["id", "name", "description"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

/**
 * Create new user
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, phone, firstName, lastName, password, roleId } = req.body;

    if (!email || !phone || !firstName || !lastName || !password) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
      return;
    }

    // Hash password
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await User.create({
      email,
      phone,
      firstName,
      lastName,
      password: hashedPassword,
      otp,
      otpExpires,
      isVerified: true,
      approvalStatus: true,
    });

    // Assign role if provided
    if (roleId) {
      await UserRole.create({
        userId: user.id,
        roleId,
      });
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

/**
 * Update user
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, phone, firstName, lastName, isVerified, approvalStatus } =
      req.body;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check email/phone uniqueness if changed
    if (email || phone) {
      const whereConditions: any[] = [];
      if (email && email !== user.email) {
        whereConditions.push({ email });
      }
      if (phone && phone !== user.phone) {
        whereConditions.push({ phone });
      }

      if (whereConditions.length > 0) {
        const existingUser = await User.findOne({
          where: {
            id: { [Op.ne]: id },
            [Op.or]: whereConditions,
          },
        });

        if (existingUser) {
          res.status(409).json({
            success: false,
            message: "Email or phone already in use",
          });
          return;
        }
      }
    }

    await user.update({
      ...(email && { email }),
      ...(phone && { phone }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(typeof isVerified === "boolean" && { isVerified }),
      ...(typeof approvalStatus === "boolean" && { approvalStatus }),
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

/**
 * Update user status
 */
export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { approvalStatus, isVerified } = req.body;

    const user = await User.findByPk(id);
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

    await user.update(updateData);

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
    });
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

/**
 * Assign role to user
 */
export const assignUserRole = async (req: AuthRequest, res: Response) => {
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
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check if role exists
    const role = await Role.findByPk(roleId);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Remove existing roles for the user
    await UserRole.destroy({ where: { userId } });

    // Assign new role
    const userRole = await UserRole.create({
      userId,
      roleId,
    });

    res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      data: userRole,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error assigning role",
      error: error.message,
    });
  }
};

/**
 * Get user statistics
 */
export const getUserStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.count();
    const verifiedUsers = await User.count({ where: { isVerified: true } });
    const approvedUsers = await User.count({ where: { approvalStatus: true } });
    const pendingUsers = await User.count({ where: { approvalStatus: false } });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        verified: verifiedUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        unverified: totalUsers - verifiedUsers,
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

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  assignUserRole,
  getUserStatistics,
};
