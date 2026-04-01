import express, { RequestHandler } from "express";
import { toggleWalletStatus, getWalletDetail } from "../controllers/admin.wallets.controller";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();
const guard = [authenticate as RequestHandler, requireRole("admin", "super_admin") as RequestHandler];

// GET  /api/v1/admin/wallets/:id  — full wallet detail
router.get("/:id", ...guard, getWalletDetail);

// PUT  /api/v1/admin/wallets/:id/status  — toggle active/inactive
router.put("/:id/status", ...guard, toggleWalletStatus);

export default router;
