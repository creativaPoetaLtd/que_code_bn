import { Response } from "express";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import database_models from "../database/config/db.config";

const { Role, RolePermission, Permission, UserRole } = database_models;

/**
 * Get all roles
 */
export const getAllRoles = async (req: AuthRequest, res: Response) => {
  try {
    const roles = await Role.findAll({
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

/**
 * Get role by ID with permissions
 */
export const getRoleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
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
    });

    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
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

/**
 * Create new role
 */
export const createRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, permissionIds } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Role name is required",
      });
      return;
    }

    // Check if role already exists
    const existingRole = await Role.findOne({
      where: { name },
    });

    if (existingRole) {
      res.status(409).json({
        success: false,
        message: "Role with this name already exists",
      });
      return;
    }

    // Create role
    const role = await Role.create({
      name,
      description: description || "",
    });

    // Assign permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        roleId: role.id,
        permissionId,
      }));
      await RolePermission.bulkCreate(rolePermissions);
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

/**
 * Update role
 */
export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Prevent editing system roles
    const systemRoles = ["super_admin", "admin", "user"];
    if (systemRoles.includes(role.name)) {
      res.status(403).json({
        success: false,
        message: "Cannot edit system roles",
      });
      return;
    }

    // Check name uniqueness if changed
    if (name && name !== role.name) {
      const existingRole = await Role.findOne({
        where: { name },
      });

      if (existingRole) {
        res.status(409).json({
          success: false,
          message: "Role name already exists",
        });
        return;
      }
    }

    await role.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
    });

    // Update permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Remove existing permissions
      await RolePermission.destroy({
        where: { roleId: id },
      });

      // Add new permissions
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        roleId: id,
        permissionId,
      }));
      await RolePermission.bulkCreate(rolePermissions);
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

/**
 * Delete role
 */
export const deleteRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Prevent deleting system roles
    const systemRoles = ["super_admin", "admin", "user"];
    if (systemRoles.includes(role.name)) {
      res.status(403).json({
        success: false,
        message: "Cannot delete system roles",
      });
      return;
    }

    // Check if role is assigned to users
    const userRoleCount = await UserRole.count({
      where: { roleId: id },
    });

    if (userRoleCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete role. It is assigned to ${userRoleCount} user(s)`,
      });
      return;
    }

    // Delete role permissions first
    await RolePermission.destroy({
      where: { roleId: id },
    });

    // Delete role
    await role.destroy();

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

/**
 * Assign permissions to role (replaces existing permissions)
 */
export const assignPermissionsToRole = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!permissionIds || !Array.isArray(permissionIds)) {
      res.status(400).json({
        success: false,
        message: "permissionIds array is required",
      });
      return;
    }

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    // Remove existing permissions
    await RolePermission.destroy({
      where: { roleId: id },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId: string) => ({
        roleId: id,
        permissionId,
      }));
      await RolePermission.bulkCreate(rolePermissions);
    }

    res.status(200).json({
      success: true,
      message: "Permissions assigned successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error assigning permissions",
      error: error.message,
    });
  }
};

/**
 * Remove specific permission from role
 */
export const removePermissionFromRole = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id, permissionId } = req.params;

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({
        success: false,
        message: "Role not found",
      });
      return;
    }

    const deleted = await RolePermission.destroy({
      where: {
        roleId: id,
        permissionId,
      },
    });

    if (deleted === 0) {
      res.status(404).json({
        success: false,
        message: "Permission not found for this role",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Permission removed successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error removing permission",
      error: error.message,
    });
  }
};

export default {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  removePermissionFromRole,
};
