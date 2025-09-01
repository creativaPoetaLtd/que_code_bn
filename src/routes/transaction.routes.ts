import express from "express";
import transactionController from "../controllers/transactionController";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();
router.use(authenticate);

// Transfer money between users
router.post("/transfer", transactionController.transferMoney);

// Get wallet balance
router.get("/wallet/:walletId/balance", transactionController.getWalletBalance);

// Get user's wallet information
router.get("/user/:userId/wallet", transactionController.getUserWallet);

// Get transaction history for a wallet
router.get("/wallet/:walletId/history", transactionController.getTransactionHistory);

router.get("/categories", transactionController.getTransactionCategories);

// Get transaction details by ID
router.get("/:transactionId", transactionController.getTransactionDetails);

export default router;
