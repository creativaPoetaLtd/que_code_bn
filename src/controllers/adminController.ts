import { Request, Response, RequestHandler } from "express";
import Models from "../database/models";
import { Op, fn, col } from "sequelize";

// Get all users with their roles
export const getAllUsers: RequestHandler = async (req: Request, res: Response) => {
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

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { count, rows: users } = await models.User.findAndCountAll({
      where: whereClause,
      attributes: {
        exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
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

// Get user by ID
export const getUserById: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const user = await models.User.findByPk(id, {
      attributes: {
        exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
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
              include: [
                {
                  model: models.RolePermission,
                  as: "rolePermissions",
                  include: [
                    {
                      model: models.Permission,
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

// Update user status (approve/reject, verify)
export const updateUserStatus: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvalStatus, isVerified } = req.body;

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const user = await models.User.findByPk(id);
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

// Assign role to user
export const assignUserRole: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      res.status(400).json({
        success: false,
        message: "userId and roleId are required",
      });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    // Check if user exists
    const user = await models.User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check if role exists
    const role = await models.Role.findByPk(roleId);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Remove existing roles for the user
    await models.UserRole.destroy({ where: { userId } });

    // Assign new role
    const userRole = await models.UserRole.create({
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

// Delete user
export const deleteUser: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const user = await models.User.findByPk(id);
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

// Get all roles
export const getAllRoles: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const roles = await models.Role.findAll({
      include: [
        {
          model: models.RolePermission,
          as: "rolePermissions",
          include: [
            {
              model: models.Permission,
              as: "permission",
              attributes: ["id", "name", "description"],
            },
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching roles",
      error: error.message,
    });
  }
};

// Get all permissions
export const getAllPermissions: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const permissions = await models.Permission.findAll({
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching permissions",
      error: error.message,
    });
  }
};

// Create new user
export const createUser: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { email, phone, firstName, lastName, password, roleId } = req.body;

    // Validate required fields
    if (!email || !phone || !firstName || !lastName || !password) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Check if user already exists
    const existingUser = await models.User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }

    // Hash password
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await models.User.create({
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
      await models.UserRole.create({
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

// Update user
export const updateUser: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;
    const { email, phone, firstName, lastName, isVerified, approvalStatus } =
      req.body;

    const user = await models.User.findByPk(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check email/phone uniqueness if changed
    if (email || phone) {
      const whereConditions: any[] = [];
      if (email && email !== user!.email) {
        whereConditions.push({ email });
      }
      if (phone && phone !== user!.phone) {
        whereConditions.push({ phone });
      }

      if (whereConditions.length > 0) {
        const existingUser = await models.User.findOne({
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
        }
      }
    }

    await user!.update({
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

// Create new role
export const createRole: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { name, description, permissionIds } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    // Check if role already exists
    const existingRole = await models.Role.findOne({
      where: { name },
    });

    if (existingRole) {
      res.status(409).json({
        success: false,
        message: "Role with this name already exists",
      });
    }

    // Create role
    const role = await models.Role.create({
      name,
      description: description || "",
    });

    // Assign permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        roleId: role.id,
        permissionId,
      }));
      await models.RolePermission.bulkCreate(rolePermissions);
    }

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating role",
      error: error.message,
    });
  }
};

// Update role
export const updateRole: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await models.Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Prevent editing system roles
    const systemRoles = ["super_admin", "admin", "user"];
    if (systemRoles.includes(role!.name)) {
      res.status(403).json({
        success: false,
        message: "Cannot edit system roles",
      });
    }

    // Check name uniqueness if changed
    if (name && name !== role!.name) {
      const existingRole = await models.Role.findOne({
        where: { name },
      });

      if (existingRole) {
        res.status(409).json({
          success: false,
          message: "Role name already exists",
        });
      }
    }

    await role!.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
    });

    // Update permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Remove existing permissions
      await models.RolePermission.destroy({
        where: { roleId: id },
      });

      // Add new permissions
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        roleId: id,
        permissionId,
      }));
      await models.RolePermission.bulkCreate(rolePermissions);
    }

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating role",
      error: error.message,
    });
  }
};

// Delete role
export const deleteRole: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;

    const role = await models.Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Prevent deleting system roles
    const systemRoles = ["super_admin", "admin", "user"];
    if (systemRoles.includes(role!.name)) {
      res.status(403).json({
        success: false,
        message: "Cannot delete system roles",
      });
    }

    // Check if role is assigned to users
    const userRoleCount = await models.UserRole.count({
      where: { roleId: id },
    });

    if (userRoleCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete role. It is assigned to ${userRoleCount} user(s)`,
      });
    }

    // Delete role permissions first
    await models.RolePermission.destroy({
      where: { roleId: id },
    });

    // Delete role
    await role!.destroy();

    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting role",
      error: error.message,
    });
  }
};

// Create new permission
export const createPermission: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Permission name is required",
      });
    }

    // Check if permission already exists
    const existingPermission = await models.Permission.findOne({
      where: { name },
    });

    if (existingPermission) {
      res.status(409).json({
        success: false,
        message: "Permission with this name already exists",
      });
    }

    const permission = await models.Permission.create({
      name,
      description: description || "",
    });

    res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating permission",
      error: error.message,
    });
  }
};

// Update permission
export const updatePermission: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;
    const { name, description } = req.body;

    const permission = await models.Permission.findByPk(id);
    if (!permission) {
      res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Check name uniqueness if changed
    if (name && name !== permission!.name) {
      const existingPermission = await models.Permission.findOne({
        where: { name },
      });

      if (existingPermission) {
        res.status(409).json({
          success: false,
          message: "Permission name already exists",
        });
      }
    }

    await permission!.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
    });

    res.status(200).json({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating permission",
      error: error.message,
    });
  }
};

// Delete permission
export const deletePermission: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;

    const permission = await models.Permission.findByPk(id);
    if (!permission) {
      res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Check if permission is assigned to roles
    const rolePermissionCount = await models.RolePermission.count({
      where: { permissionId: id },
    });

    if (rolePermissionCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete permission. It is assigned to ${rolePermissionCount} role(s)`,
      });
    }

    await permission!.destroy();

    res.status(200).json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting permission",
      error: error.message,
    });
  }
};

// Get role with permissions
export const getRoleWithPermissions: RequestHandler = async (req: Request, res: Response) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;

    const role = await models.Role.findByPk(id, {
      include: [
        {
          model: models.RolePermission,
          as: "rolePermissions",
          include: [
            {
              model: models.Permission,
              as: "permission",
            },
          ],
        },
      ],
    });

    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching role",
      error: error.message,
    });
  }
};

// Get all transactions (admin view)
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all",
      type = "all",
      startDate,
      endDate,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClause: any = {};

    // Filter by status
    if (status !== "all") {
      whereClause.status = status;
    }

    // Filter by type
    if (type !== "all") {
      whereClause.type = type;
    }

    // Filter by date range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    // Search by reference ID or description
    if (search) {
      whereClause[Op.or] = [
        { referenceId: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { externalSenderName: { [Op.iLike]: `%${search}%` } },
        { senderNames: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const { count, rows: transactions } =
      await models.Transaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: models.Wallet,
            as: "senderWallet",
            attributes: ["id", "balance", "currency"],
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email", "phone"],
              },
              {
                model: models.Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
              },
            ],
          },
          {
            model: models.Wallet,
            as: "receiverWallet",
            attributes: ["id", "balance", "currency"],
            include: [
              {
                model: models.User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email", "phone"],
              },
              {
                model: models.Organization,
                as: "organization",
                attributes: ["id", "name", "email"],
              },
            ],
          },
          {
            model: models.Category,
            as: "category",
            attributes: ["id", "name"],
          },
          {
            model: models.ActionPurchase,
            as: "actionPurchase",
            attributes: ["id", "quantity", "totalAmount"],
            include: [
              {
                model: models.Action,
                as: "action",
                attributes: ["id", "name", "type"],
              },
              {
                model: models.SubAction,
                as: "subAction",
                attributes: ["id", "name", "price"],
              },
            ],
          },
        ],
        limit: Number(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

    // Calculate statistics
    const stats = await models.Transaction.findAll({
      attributes: [
        [fn("COUNT", col("id")), "total"],
        [fn("SUM", col("amount")), "totalAmount"],
        "status",
        "type",
      ],
      group: ["status", "type"],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: transactions,
      statistics: stats,
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
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

// Get transaction by ID (admin view with full details)
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const transaction = await models.Transaction.findByPk(id, {
      include: [
        {
          model: models.Wallet,
          as: "senderWallet",
          include: [
            {
              model: models.User,
              as: "user",
              attributes: {
                exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
              },
            },
            {
              model: models.Organization,
              as: "organization",
            },
          ],
        },
        {
          model: models.Wallet,
          as: "receiverWallet",
          include: [
            {
              model: models.User,
              as: "user",
              attributes: {
                exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
              },
            },
            {
              model: models.Organization,
              as: "organization",
            },
          ],
        },
        {
          model: models.Category,
          as: "category",
        },
        {
          model: models.ActionPurchase,
          as: "actionPurchase",
          include: [
            {
              model: models.Action,
              as: "action",
            },
            {
              model: models.SubAction,
              as: "subAction",
            },
          ],
        },
      ],
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching transaction",
      error: error.message,
    });
  }
};

export default {
  getAllUsers,
  getUserById,
  updateUserStatus,
  assignUserRole,
  deleteUser,
  createUser,
  updateUser,
  getAllRoles,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
  createPermission,
  updatePermission,
  deletePermission,
  getRoleWithPermissions,
  getAllTransactions,
  getTransactionById,
};
