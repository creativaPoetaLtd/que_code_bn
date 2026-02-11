import express, { RequestHandler } from "express";
import permissionController from "../controllers/permissionController";
import {
  authenticate,
  requireRole,
  requirePermission,
} from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate as RequestHandler);

// ============================================
// PERMISSION MANAGEMENT ROUTES
// ============================================

/**
 * GET /permissions
 * Get all permissions
 * Requires: admin role OR view_roles permission
 */
router.get(
  "/",
  requireRole("admin", "super_admin") as RequestHandler,
  requirePermission("view_roles") as RequestHandler,
  permissionController.getAllPermissions as RequestHandler
);

/**
 * GET /permissions/:id
 * Get permission by ID
 * Requires: admin role OR view_roles permission
 */
router.get(
  "/:id",
  requireRole("admin", "super_admin") as RequestHandler,
  requirePermission("view_roles") as RequestHandler,
  permissionController.getPermissionById as RequestHandler
);

/**
 * POST /permissions
 * Create new permission
 * Requires: super_admin role only
 */
router.post(
  "/",
  requireRole("super_admin") as RequestHandler,
  permissionController.createPermission as RequestHandler
);

/**
 * PUT /permissions/:id
 * Update permission
 * Requires: super_admin role only
 */
router.put(
  "/:id",
  requireRole("super_admin") as RequestHandler,
  permissionController.updatePermission as RequestHandler
);

/**
 * DELETE /permissions/:id
 * Delete permission (checks if in use)
 * Requires: super_admin role only
 */
router.delete(
  "/:id",
  requireRole("super_admin") as RequestHandler,
  permissionController.deletePermission as RequestHandler
);

export default router;
