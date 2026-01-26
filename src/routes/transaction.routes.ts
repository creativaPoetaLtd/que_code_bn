import express from "express";
import transactionController from "../controllers/transactionController";
import { downloadReceipt } from "../controllers/receiptController";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();
router.use(authenticate);

// Get recent send recipients for authenticated user
router.get("/recent-sends", transactionController.getRecentSends as express.RequestHandler);

// Transfer money between users
router.post("/transfer", transactionController.transferMoney as express.RequestHandler);

// Download transaction receipt
router.get("/receipt/:transactionId", downloadReceipt as express.RequestHandler);

// Get wallet balance
router.get("/wallet/:walletId/balance", transactionController.getWalletBalance);

// Get user's wallet information
router.get("/user/:userId/wallet", transactionController.getUserWallet);

// Get organization's wallet information
router.get("/organization/:organizationId/wallet", transactionController.getOrganizationWallet);

// Get wallet restrictions
router.get("/wallet/:walletId/restrictions", transactionController.getWalletRestrictions);

// Get wallet balance breakdown (restricted vs unrestricted)
router.get("/wallet/:walletId/balance-breakdown", transactionController.getWalletBalanceBreakdown);

// Get transaction history for a wallet
router.get("/wallet/:walletId/history", transactionController.getTransactionHistory);

router.get("/categories", transactionController.getTransactionCategories);

// Get transaction details by ID
router.get("/:transactionId", transactionController.getTransactionDetails);

export default router;
