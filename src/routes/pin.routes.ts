import express from "express";
import pinController from "../controllers/pinController";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();
router.use(authenticate);

// Setup PIN for first-time users
router.post("/setup", pinController.setupPIN as express.RequestHandler);

// Verify PIN for transactions
router.post("/verify", pinController.verifyPIN as express.RequestHandler);

// Change existing PIN
router.put("/change", pinController.changePIN as express.RequestHandler);

// Reset PIN attempts (admin function)
router.post("/reset-attempts", pinController.resetPinAttempts as express.RequestHandler);

// Get PIN status for current user
router.get("/status", pinController.getPinStatus as express.RequestHandler);

export default router;