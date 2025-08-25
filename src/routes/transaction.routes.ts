import express from "express";
import transactionController from "../controllers/transactionController";

const router = express.Router();

// Transfer money between users
router.post("/transfer", transactionController.transfer_money);

// Get transaction history for a user
router.get("/history/:userId", transactionController.get_transaction_history);

// Get wallet balance for a user
router.get("/wallet/:userId", transactionController.get_wallet_balance);

// Create wallet for user (admin function)
router.post("/wallet/create", transactionController.create_wallet);

// Add money to wallet (admin function or deposit)
router.post("/wallet/deposit", transactionController.add_money_to_wallet);

// Get all expense categories
router.get("/categories", transactionController.getCategories);

// Get transaction by ID
router.get("/:transactionId", transactionController.get_transaction_by_id);

export default router;
