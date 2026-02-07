import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import database_models from "../database/config/db.config";

const { User, Organization, UserRole, Role, RolePermission, Permission } =
  database_models;

// Custom user type for authenticated requests
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
  accountType: "user" | "organization";
  organizationId?: string;
  isAdmin: boolean;
}

// Extended Request interface - omit user and redefine it
export interface AuthRequest extends Omit<Request, "user"> {
  user?: AuthenticatedUser;
}

/**
 * Main authentication middleware
 * Verifies JWT token and loads user with roles and permissions
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or cookies
    let token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token && req.cookies?.token) {
      try {
        const cookieData =
          typeof req.cookies.token === "string"
            ? JSON.parse(req.cookies.token)
            : req.cookies.token;
        token = cookieData.value || cookieData;
      } catch (e) {
        token = req.cookies.token;
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        accountType?: string;
        role?: string;
      };

      let entity = null;
      let accountType: "user" | "organization" = "user";

      // Check if it's an organization token
      if (decoded.accountType === "organization") {
        entity = await Organization.findByPk(decoded.id);
        accountType = "organization";
      } else {
        // Default to user lookup
        entity = await User.findByPk(decoded.id, {
          attributes: {
            exclude: ["password", "transactionPin", "otp", "pinResetOtp"],
          },
        });
      }

      if (!entity) {
        res.status(401).json({
          success: false,
          message:
            accountType === "organization"
              ? "Organization not found"
              : "User not found",
        });
        return;
      }

      // Fetch user's roles and permissions
      const userRoles = (await UserRole.findAll({
        where: { userId: decoded.id },
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
      })) as any[];

      // Extract roles and permissions
      const roles = userRoles
        .map((ur: any) => ur.role?.name)
        .filter(Boolean) as string[];
      const primaryRole = roles[0] || decoded.role || "user";

      const permissions = new Set<string>();
      userRoles.forEach((ur: any) => {
        ur.role?.rolePermissions?.forEach((rp: any) => {
          if (rp.permission?.name) {
            permissions.add(rp.permission.name);
          }
        });
      });

      const isAdmin = roles.includes("super_admin") || roles.includes("admin");

      // Get organizationId based on account type
      const organizationId =
        accountType === "organization"
          ? decoded.id
          : (entity as any).organizationId;

      // Attach comprehensive user info to request
      req.user = {
        id: decoded.id,
        email: entity.email,
        role: primaryRole,
        roles: roles,
        permissions: Array.from(permissions),
        accountType,
        organizationId,
        isAdmin,
      };

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: "Access denied. Invalid token.",
      });
      return;
    }
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
    return;
  }
};

/**
 * Role-based authorization middleware
 * Usage: requireRole('admin', 'super_admin')
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Check if user has any of the allowed roles
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient role privileges.",
        required: allowedRoles,
        current: req.user.roles,
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Usage: requirePermission('view_users', 'edit_users')
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Admins bypass permission checks
    if (req.user.isAdmin) {
      next();
      return;
    }

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        required: requiredPermissions,
        current: req.user.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Combined access control - requires ALL specified permissions
 * Usage: requireAllPermissions('view_users', 'edit_users')
 */
export const requireAllPermissions = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Admins bypass permission checks
    if (req.user.isAdmin) {
      next();
      return;
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter(
        (perm) => !req.user!.permissions.includes(perm)
      );

      res.status(403).json({
        success: false,
        message: "Access denied. Missing required permissions.",
        missing,
        required: requiredPermissions,
        current: req.user.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Flexible access control middleware
 * Usage: requireAccess({ roles: ['admin'], permissions: ['view_users'], requireAll: false })
 */
interface AccessControlOptions {
  roles?: string[];
  permissions?: string[];
  requireAll?: boolean; // If true, must have ALL permissions; if false, ANY permission
}

export const requireAccess = (options: AccessControlOptions) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { roles = [], permissions = [], requireAll = false } = options;

    // Check roles
    const hasRole =
      roles.length === 0 || req.user.roles.some((role) => roles.includes(role));

    // Admins bypass permission checks
    if (req.user.isAdmin && hasRole) {
      next();
      return;
    }

    // Check permissions
    let hasPermission = true;
    if (permissions.length > 0) {
      if (requireAll) {
        hasPermission = permissions.every((perm) =>
          req.user!.permissions.includes(perm)
        );
      } else {
        hasPermission = permissions.some((perm) =>
          req.user!.permissions.includes(perm)
        );
      }
    }

    if (!hasRole || !hasPermission) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient privileges.",
        required: { roles, permissions, requireAll },
        current: {
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Shorthand middleware for common access patterns
 */
export const adminOnly = requireRole("super_admin", "admin");
export const superAdminOnly = requireRole("super_admin");
export const moderatorOrAbove = requireRole(
  "super_admin",
  "admin",
  "moderator"
);
export const orgAdminOrAbove = requireRole(
  "super_admin",
  "admin",
  "organization_admin"
);

/**
 * Optional authentication - Adds user info if token is present but doesn't require it
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token && req.cookies?.token) {
      try {
        const cookieData =
          typeof req.cookies.token === "string"
            ? JSON.parse(req.cookies.token)
            : req.cookies.token;
        token = cookieData.value || cookieData;
      } catch (e) {
        token = req.cookies.token;
      }
    }

    if (token) {
      try {
        await authenticate(req, res, () => {});
      } catch (error) {
        // Silently ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};
