import { Request, Response, NextFunction } from "express";
import database_models from "../database/config/db.config";

const { UserRole, Role, RolePermission } = database_models;

// Extend Request type to include scope
export interface ScopedRequest extends Request {
  user?: any;
  scope?: {
    userId: string;
    role: string;
    isAdmin: boolean;
    canViewAll: boolean;
    organizationId?: string;
    permissions: string[];
  };
}

/**
 * Middleware that adds role-based scope information to the request
 * This allows controllers to adjust query behavior based on user role
 */
export const addUserScope = async (
  req: ScopedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;

    // Fetch user's roles and permissions
    const userRoles = (await UserRole.findAll({
      where: { userId },
      include: [
        {
          model: Role,
          as: "role",
          include: [
            {
              model: RolePermission,
              as: "rolePermissions",
              include: ["permission"],
            },
          ],
        },
      ],
    })) as any[];

    // Extract role names and permissions
    const roles = userRoles
      .map((ur: any) => ur.role?.name)
      .filter(Boolean) as string[];
    const primaryRole = roles[0] || "user";

    const permissions = new Set<string>();
    userRoles.forEach((ur: any) => {
      ur.role?.rolePermissions?.forEach((rp: any) => {
        if (rp.permission?.name) {
          permissions.add(rp.permission.name);
        }
      });
    });

    // Determine access levels
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    const canViewAll =
      isAdmin ||
      roles.includes("moderator") ||
      roles.includes("organization_admin") ||
      permissions.has("view_transactions");

    // Add scope to request
    req.scope = {
      userId,
      role: primaryRole,
      isAdmin,
      canViewAll,
      organizationId: req.user.organizationId,
      permissions: Array.from(permissions),
    };

    next();
  } catch (error: any) {
    console.error("Error in addUserScope middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Error determining user scope",
      error: error.message,
    });
  }
};

/**
 * Middleware specifically for admin routes
 * Ensures user has admin privileges
 */
export const requireAdminScope = (
  req: ScopedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.scope) {
    return res.status(401).json({
      success: false,
      message: "Scope not initialized",
    });
  }

  if (!req.scope.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};

/**
 * Middleware to check specific permission
 */
export const requirePermission = (permission: string) => {
  return (req: ScopedRequest, res: Response, next: NextFunction) => {
    if (!req.scope) {
      return res.status(401).json({
        success: false,
        message: "Scope not initialized",
      });
    }

    if (!req.scope.permissions.includes(permission) && !req.scope.isAdmin) {
      return res.status(403).json({
        success: false,
        message: `Permission required: ${permission}`,
      });
    }

    next();
  };
};
