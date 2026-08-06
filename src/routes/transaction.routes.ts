import express, { RequestHandler } from "express";
import transactionController from "../controllers/transactionController";
import { downloadReceipt } from "../controllers/receiptController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Apply authentication to all transaction routes
router.use(authenticate as RequestHandler);

// Get recent send recipients for authenticated user
router.get(
  "/recent-sends",
  transactionController.getRecentSends as express.RequestHandler,
);

// Transfer money between users
router.post(
  "/transfer",
  transactionController.transferMoney as express.RequestHandler,
);

// Download transaction receipt
router.get(
  "/receipt/:transactionId",
  downloadReceipt as express.RequestHandler,
);

// Get wallet balance
router.get("/wallet/:walletId/balance", transactionController.getWalletBalance);

// Unified wallets listing (admin usage)
router.get(
  "/wallets/all",
  transactionController.getAllWallets as express.RequestHandler,
);

// Get transaction categories
router.get("/categories", transactionController.getTransactionCategories);

// UNIFIED ENDPOINTS - Role-based access
// Admins see all transactions, regular users see only their own
router.get(
  "/all",
  transactionController.getAllTransactions as express.RequestHandler,
);

// Restriction CRUD endpoints (must come before /:id to avoid conflicts)
// Unified restrictions listing (admin usage)
router.get(
  "/restrictions/all",
  transactionController.getAllRestrictions as express.RequestHandler,
);

// Create a wallet restriction (admin only)
router.post(
  "/restrictions",
  transactionController.createRestriction as express.RequestHandler,
);

// Update a wallet restriction (admin only)
router.put(
  "/restrictions/:id",
  transactionController.updateRestriction as express.RequestHandler,
);

// Delete a wallet restriction (admin only)
router.delete(
  "/restrictions/:id",
  transactionController.deleteRestriction as express.RequestHandler,
);

// Incoming rules (auto-categorize received money by sender) — self-service
router.get(
  "/wallet/:walletId/incoming-rules",
  transactionController.getWalletIncomingRules as express.RequestHandler,
);
router.get(
  "/wallet/:walletId/incoming-senders",
  transactionController.getIncomingSenders as express.RequestHandler,
);
router.post(
  "/incoming-rules",
  transactionController.createIncomingRule as express.RequestHandler,
);
router.put(
  "/incoming-rules/:id",
  transactionController.updateIncomingRule as express.RequestHandler,
);
router.delete(
  "/incoming-rules/:id",
  transactionController.deleteIncomingRule as express.RequestHandler,
);

// Get user's wallet information
router.get("/user/:userId/wallet", transactionController.getUserWallet);

// Get organization's wallet information
router.get(
  "/organization/:organizationId/wallet",
  transactionController.getOrganizationWallet,
);

// Get wallet restrictions
router.get(
  "/wallet/:walletId/restrictions",
  transactionController.getWalletRestrictions,
);

// Get wallet balance breakdown (restricted vs unrestricted)
router.get(
  "/wallet/:walletId/balance-breakdown",
  transactionController.getWalletBalanceBreakdown,
);

// Get transaction history for a wallet
router.get(
  "/wallet/:walletId/history",
  transactionController.getTransactionHistory
);

// Get contact transaction stats
router.get("/wallet/:walletId/contact-stats", transactionController.getContactStats);

router.get("/categories", transactionController.getTransactionCategories);

// UNIFIED ENDPOINTS - Role-based access
// Admins see all transactions, regular users see only their own
router.get(
  "/all",
  transactionController.getAllTransactions as express.RequestHandler
);

// Payment requests
router.post(
  "/request",
  transactionController.createPaymentRequest as express.RequestHandler
);

router.get(
  "/requests",
  transactionController.getUserPaymentRequests as express.RequestHandler
);

router.get(
  "/request/:id",
  transactionController.getPaymentRequestById as express.RequestHandler
);

router.get(
  "/request/:id/qr",
  transactionController.getPaymentRequestQR as express.RequestHandler
);

router.patch(
  "/request/:id/accept",
  transactionController.acceptPaymentRequest as express.RequestHandler
);

router.patch(
  "/request/:id/decline",
  transactionController.declinePaymentRequest as express.RequestHandler
);

// Get single transaction by ID with role-based access control (must be last)
router.get(
  "/:id",
  transactionController.getTransactionById as express.RequestHandler,
);

// Legacy endpoint for backward compatibility
router.get(
  "/:transactionId/details",
  transactionController.getTransactionDetails,
);

export default router;
