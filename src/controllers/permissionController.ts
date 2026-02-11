import { Response } from "express";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import database_models from "../database/config/db.config";

const { Permission, RolePermission } = database_models;

/**
 * Get all permissions
 */
export const getAllPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await Permission.findAll({
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

/**
 * Get permission by ID
 */
export const getPermissionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const permission = await Permission.findByPk(id);

    if (!permission) {
      res.status(404).json({
        success: false,
        message: "Permission not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: permission,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching permission",
      error: error.message,
    });
  }
};

/**
 * Create new permission
 */
export const createPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Permission name is required",
      });
      return;
    }

    // Check if permission already exists
    const existingPermission = await Permission.findOne({
      where: { name },
    });

    if (existingPermission) {
      res.status(409).json({
        success: false,
        message: "Permission with this name already exists",
      });
      return;
    }

    const permission = await Permission.create({
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

/**
 * Update permission
 */
export const updatePermission = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const permission = await Permission.findByPk(id);
    if (!permission) {
      res.status(404).json({
        success: false,
        message: "Permission not found",
      });
      return;
    }

    // Check name uniqueness if changed
    if (name && name !== permission.name) {
      const existingPermission = await Permission.findOne({
        where: { name },
      });

      if (existingPermission) {
        res.status(409).json({
          success: false,
          message: "Permission name already exists",
        });
        return;
      }
    }

    await permission.update({
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

/**
 * Delete permission
 */
export const deletePermission = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const permission = await Permission.findByPk(id);
    if (!permission) {
      res.status(404).json({
        success: false,
        message: "Permission not found",
      });
      return;
    }

    // Check if permission is assigned to roles
    const rolePermissionCount = await RolePermission.count({
      where: { permissionId: id },
    });

    if (rolePermissionCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete permission. It is assigned to ${rolePermissionCount} role(s)`,
      });
      return;
    }

    await permission.destroy();

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

export default {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
};
