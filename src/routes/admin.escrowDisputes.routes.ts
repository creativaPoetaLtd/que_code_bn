import express, { RequestHandler } from "express";
import adminEscrowDisputesController from "../controllers/admin.escrowDisputes.controller";
import { authenticate, adminOnly } from "../middleware/auth.unified.middleware";

const router = express.Router();

router.use(authenticate as RequestHandler);
router.use(adminOnly as RequestHandler);

router.get("/", adminEscrowDisputesController.getAllDisputes as RequestHandler);
router.get("/:id", adminEscrowDisputesController.getDisputeById as RequestHandler);

export default router;
