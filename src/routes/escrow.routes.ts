import express, { RequestHandler } from "express";
import escrowController from "../controllers/escrowController";
import { authenticate, adminOnly } from "../middleware/auth.unified.middleware";

const router = express.Router();

router.use(authenticate as RequestHandler);

router.post("/", escrowController.createEscrow as RequestHandler);
router.get("/", escrowController.listMyEscrows as RequestHandler);
router.get("/:id", escrowController.getEscrowById as RequestHandler);
router.post("/:id/release", escrowController.releaseEscrow as RequestHandler);
router.post("/:id/fulfill", escrowController.fulfillEscrow as RequestHandler);
router.post("/:id/refund", escrowController.refundEscrow as RequestHandler);
router.post("/:id/dispute", escrowController.raiseDispute as RequestHandler);
router.post("/:id/dispute/respond", escrowController.respondToDispute as RequestHandler);
router.post("/:id/resolve", adminOnly as RequestHandler, escrowController.resolveDispute as RequestHandler);

export default router;
