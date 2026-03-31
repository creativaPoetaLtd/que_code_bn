import express from "express";
import userRouter from "./user.routes";
import roleRouter from "./role.routes";
import permissionRouter from "./permission.routes";
import transactionRouter from "./transaction.routes";
import actionRouter from "./admin.action.routes";
import adminGroupsRouter from "./admin.groups.routes";

const router = express.Router();

// ============================================
// ADMIN PANEL ROUTES
// ============================================
// All routes use unified authentication with role/permission middleware
// Access control is handled at the route level via:
// - authenticate: Verifies JWT and loads user with roles/permissions
// - requireRole(...roles): Requires user to have one of the specified roles
// - requirePermission(...perms): Requires user to have one of the specified permissions
// ============================================

// User management (admin functions in userController with middleware)
router.use("/users", userRouter);

// Role management (admin only)
router.use("/roles", roleRouter);

// Permission management (super_admin only)
router.use("/permissions", permissionRouter);

// Transaction management (role-based filtering)
router.use("/transactions", transactionRouter);

// Action management (admin only)
router.use("/actions", actionRouter);

// Group management (admin only)
router.use("/groups", adminGroupsRouter);

export default router;
