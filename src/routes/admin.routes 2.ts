// routes/admin.routes.ts
import express from "express";
import adminController from "../controllers/adminController";
import {
  requireAdmin,
  requirePermission,
} from "../middleware/admin.auth.middleware";

const router = express.Router();

/**
 * All admin routes require admin authentication
 * Uses separate admin JWT secret for security
 */
router.use(requireAdmin);

// ============================================
// User Management Routes
// ============================================
router.get("/users", adminController.getAllUsers);
router.get("/users/:id", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.post("/users/assign-role", adminController.assignUserRole);
router.delete("/users/:id", adminController.deleteUser);

// ============================================
// Role Management Routes
// ============================================
router.get("/roles", adminController.getAllRoles);
router.get("/roles/:id", adminController.getRoleWithPermissions);
router.post("/roles", adminController.createRole);
router.put("/roles/:id", adminController.updateRole);
router.delete("/roles/:id", adminController.deleteRole);

// ============================================
// Permission Management Routes
// ============================================
router.get("/permissions", adminController.getAllPermissions);
router.post("/permissions", adminController.createPermission);
router.put("/permissions/:id", adminController.updatePermission);
router.delete("/permissions/:id", adminController.deletePermission);

// ============================================
// Transaction Management Routes
// ============================================
router.get("/transactions", adminController.getAllTransactions);
router.get("/transactions/:id", adminController.getTransactionById);

export default router;
