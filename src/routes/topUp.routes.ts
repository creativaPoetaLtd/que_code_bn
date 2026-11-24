import express, { RequestHandler } from "express";
import * as topUpController from "../controllers/topUpController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();
const handle = (fn: unknown) => fn as RequestHandler;

router.use(authenticate as unknown as RequestHandler);

router.get("/options", handle(topUpController.getTopUpOptions));
router.post("/", handle(topUpController.createTopUp));
router.get("/", handle(topUpController.listMyTopUps));
router.get("/:id", handle(topUpController.getTopUp));
router.post("/:id/simulate", handle(topUpController.simulateTopUpOutcome));

export default router;
