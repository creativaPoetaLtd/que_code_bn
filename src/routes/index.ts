import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import resetRouter from "./reset.routes";
import transactionRouter from "./transaction.routes";
import analyticsRouter from "./analytics.routes";
import contactRouter from "./contact.routes";
import contactInvitationRouter from "./contactInvitation.routes";
import organizationCategoryRouter from "./organizationCategory.routes";
import profileRouter from "./profile.routes";
import groupRouter from "./group.routes";
import notificationRouter from "./notification.routes";
import pinRouter from "./pin.routes";
import chatRouter from "./chat.routes";
import actionRouter from "./action.routes";
import roleRouter from "./role.routes";
import permissionRouter from "./permission.routes";
import adminDashboardRouter from "./admin.dashboard.routes";
import auditLogRouter from "./auditLog.routes";
import outsideMessageRouter from "./outsideMessage.routes";

import fcmRouter from "./fcm.routes";
import pushSubscriptionRouter from "./pushSubscription.routes";
import supportRouter from "./support.routes";
import linkPreviewRouter from "./link-preview.routes";

// Admin routes (unified authentication with role/permission middleware)
import adminAuthRouter from "./admin.auth.routes";
import adminMainRouter from "./admin.main.routes";

const router = express.Router();

// ============================================
// USER/PUBLIC ROUTES (with role-based access)
// ============================================
// Most routes now use role-based middleware:
// - Admins automatically see all data
// - Regular users see only their own data
// - Organization admins see their organization's data
// Example: GET /api/v1/transactions/all shows:
//   - All transactions (if admin)
//   - User's own transactions (if regular user)
// ============================================
router.use("/organizations", orgRouter);
router.use("/organization-categories", organizationCategoryRouter);
router.use("/profiles", profileRouter);
router.use("/users", userRouter);
router.use("/users/pin", pinRouter);
router.use("/auth", resetRouter);
router.use("/transactions", transactionRouter); // Includes unified endpoints
router.use("/analytics", analyticsRouter);
router.use("/contacts", contactRouter);
router.use("/contact-invitations", contactInvitationRouter);
router.use("/groups", groupRouter);
router.use("/notifications", notificationRouter);
router.use("/chats", chatRouter);
router.use("/support", supportRouter);
router.use("/outside-messages", outsideMessageRouter);
router.use("/fcm", fcmRouter);
router.use("/push-subscriptions", pushSubscriptionRouter);
router.use("/link-preview", linkPreviewRouter);
router.use("", actionRouter);

// Role and Permission management (admin-only with middleware)
router.use("/roles", roleRouter);
router.use("/permissions", permissionRouter);

// ============================================
// ADMIN ROUTES (Unified Authentication)
// ============================================
// Uses standard JWT auth with role/permission-based access control
// Middleware in routes: requireRole(), requirePermission()
// Admin-specific routes can be accessed via:
// - /api/v1/admin/users (with admin middleware - shows all users)
// - /api/v1/admin/roles (admin-only role management)
// - /api/v1/admin/permissions (super_admin-only permission management)
// - /api/v1/admin/transactions (role-based filtering)
// - /api/v1/admin/actions (admin-only action management)
router.use("/admin/auth", adminAuthRouter); // Admin login (separate auth for now)
router.use("/admin/dashboard", adminDashboardRouter);
router.use("/admin/audit-logs", auditLogRouter); // Audit logs (admin-only)
router.use("/admin", adminMainRouter); // Admin panel routes (users, roles, permissions, transactions, actions)

export default router;
