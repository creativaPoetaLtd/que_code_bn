import express, { RequestHandler } from "express";
import scheduledTransferController from "../controllers/scheduledTransferController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

router.use(authenticate as RequestHandler);

router.post("/", scheduledTransferController.createScheduledTransfer as RequestHandler);
router.get("/", scheduledTransferController.listScheduledTransfers as RequestHandler);

// Scheduled batch transfers (multiple recipients, one schedule) - must come before /:id
router.post("/batch", scheduledTransferController.createScheduledBatchTransfer as RequestHandler);
router.get("/batches", scheduledTransferController.listScheduledBatches as RequestHandler);
router.get("/batch/:id", scheduledTransferController.getScheduledBatchById as RequestHandler);
router.post("/batch/:id/cancel", scheduledTransferController.cancelScheduledBatch as RequestHandler);

router.get("/:id", scheduledTransferController.getScheduledTransferById as RequestHandler);
router.patch("/:id", scheduledTransferController.updateScheduledTransfer as RequestHandler);
router.post("/:id/cancel", scheduledTransferController.cancelScheduledTransfer as RequestHandler);
router.post("/:id/pause", scheduledTransferController.pauseScheduledTransfer as RequestHandler);
router.post("/:id/resume", scheduledTransferController.resumeScheduledTransfer as RequestHandler);
router.post("/:id/skip-next", scheduledTransferController.skipNextOccurrence as RequestHandler);

export default router;
