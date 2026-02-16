import express, { RequestHandler } from "express";
import adminAnalyticsController from "../controllers/admin.analytics.controller";
import {
  authenticate,
  requireRole,
} from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate as RequestHandler);

// Apply admin role requirement to all routes
router.use(requireRole("admin", "super_admin") as RequestHandler);

// ============================================
// ADMIN ANALYTICS ROUTES
// ============================================

/**
 * GET /admin/analytics/dashboard-overview
 * Get comprehensive dashboard overview with all KPIs
 * Returns: users, organizations, volume, risk metrics, flow summary, financial snapshot
 */
router.get(
  "/dashboard-overview",
  adminAnalyticsController.getDashboardOverview as RequestHandler,
);

/**
 * GET /admin/analytics/transactions-chart
 * Get transaction data for chart visualization
 * Query params: ?days=7 (default 7, can be 7, 30, 90)
 * Returns: daily transaction counts, volumes, and disputes
 */
router.get(
  "/transactions-chart",
  adminAnalyticsController.getTransactionsChart as RequestHandler,
);

/**
 * GET /admin/analytics/top-events
 * Get today's top events/activities for audit trail
 * Returns: organization approvals, role assignments, action creations, etc.
 */
router.get(
  "/top-events",
  adminAnalyticsController.getTopEvents as RequestHandler,
);

/**
 * GET /admin/analytics/user-growth
 * Get user growth data over time
 * Query params: ?days=30 (default 30)
 * Returns: daily user registration counts
 */
router.get(
  "/user-growth",
  adminAnalyticsController.getUserGrowth as RequestHandler,
);

/**
 * GET /admin/analytics/organization-stats
 * Get detailed organization statistics
 * Returns: counts by status, by category, recent activity
 */
router.get(
  "/organization-stats",
  adminAnalyticsController.getOrganizationStats as RequestHandler,
);

/**
 * GET /admin/analytics/transaction-stats
 * Get detailed transaction statistics
 * Query params: ?days=30 (default 30)
 * Returns: counts/volumes by status, by type, daily breakdown
 */
router.get(
  "/transaction-stats",
  adminAnalyticsController.getTransactionStats as RequestHandler,
);

export default router;
