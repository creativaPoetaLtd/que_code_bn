import express, { RequestHandler } from "express";
import roleController from "../controllers/roleController";
import {
  authenticate,
  requireRole,
  requirePermission,
} from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate as RequestHandler);

// ============================================
// ROLE MANAGEMENT ROUTES
// ============================================

/**
 * GET /roles
 * Get all roles with permissions
 * Requires: admin or super_admin role
 */
router.get(
  "/",
  requireRole("admin", "super_admin") as RequestHandler,
  roleController.getAllRoles as RequestHandler
);

/**
 * GET /roles/:id
 * Get role by ID with full permission details
 * Requires: admin or super_admin role
 */
router.get(
  "/:id",
  requireRole("admin", "super_admin") as RequestHandler,
  roleController.getRoleById as RequestHandler
);

/**
 * POST /roles
 * Create new role
 * Requires: super_admin role OR create_roles permission
 */
router.post(
  "/",
  requireRole("super_admin", "admin" ) as RequestHandler,
  roleController.createRole as RequestHandler
);

/**
 * PUT /roles/:id
 * Update role and its permissions
 * Requires: super_admin role OR edit_roles permission
 */
router.put(
  "/:id",
  requireRole("super_admin") as RequestHandler,
  roleController.updateRole as RequestHandler
);

/**
 * DELETE /roles/:id
 * Delete role (system roles protected)
 * Requires: super_admin role OR delete_roles permission
 */
router.delete(
  "/:id",
  requireRole("super_admin") as RequestHandler,
  roleController.deleteRole as RequestHandler
);

/**
 * POST /roles/:id/permissions
 * Assign permissions to role
 * Requires: super_admin role
 */
router.post(
  "/:id/permissions",
  requireRole("super_admin") as RequestHandler,
  roleController.assignPermissionsToRole as RequestHandler
);

/**
 * DELETE /roles/:id/permissions/:permissionId
 * Remove permission from role
 * Requires: super_admin role
 */
router.delete(
  "/:id/permissions/:permissionId",
  requireRole("super_admin") as RequestHandler,
  roleController.removePermissionFromRole as RequestHandler
);

export default router;
