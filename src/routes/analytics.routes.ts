import express from "express";
import analyticsController from "../controllers/analyticsController";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();
router.use(authenticate);

// GET /api/analytics/summary - Get expense summary
router.get('/summary', analyticsController.getExpenseSummary);

// GET /api/analytics/category-breakdown - Get expense breakdown by categories
router.get('/category-breakdown', analyticsController.getCategoryBreakdown);

// GET /api/analytics/spending-trends - Get spending trends over time
router.get('/spending-trends', analyticsController.getSpendingTrends);

// GET /api/analytics/recent-transactions - Get recent transactions with categories
router.get('/recent-transactions', analyticsController.getRecentTransactions);

export default router;
