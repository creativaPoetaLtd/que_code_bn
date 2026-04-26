import { Router, RequestHandler } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createOutsideMessage,
  getOutsideMessagesInbox,
  markOutsideMessageRead,
} from "../controllers/outsideMessageController";

const router = Router();

router.post("/", createOutsideMessage as RequestHandler);

router.use(authenticate);
router.get("/inbox", getOutsideMessagesInbox as RequestHandler);
router.patch("/:id/read", markOutsideMessageRead as RequestHandler);

export default router;
