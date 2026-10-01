import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as billController from "../controllers/billController";

const router = Router();
router.use(authenticate);

// Creation + reading
router.post("/", billController.createBill as RequestHandler);
router.get("/", billController.listMyBills as RequestHandler);
router.get("/:id", billController.getBillById as RequestHandler);

// Share actions
router.post("/:id/shares/:shareId/pay", billController.payShare as RequestHandler);
router.post("/:id/shares/:shareId/decline", billController.declineShare as RequestHandler);
router.post("/:id/shares/:shareId/cover", billController.coverShare as RequestHandler);
router.post("/:id/shares/:shareId/reassign", billController.reassignShare as RequestHandler);
router.post("/:id/shares/:shareId/close", billController.closeShare as RequestHandler);
router.post("/:id/shares/:shareId/remind", billController.remindShare as RequestHandler);

// Whole-bill action
router.post("/:id/cancel", billController.cancelBill as RequestHandler);

export default router;
