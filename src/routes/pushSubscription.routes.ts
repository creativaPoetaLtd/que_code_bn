import { Router } from "express";
import {
  deletePushSubscription,
  upsertPushSubscription,
} from "../controllers/pushSubscriptionController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, upsertPushSubscription as any);
router.delete("/", authenticate, deletePushSubscription as any);

export default router;
