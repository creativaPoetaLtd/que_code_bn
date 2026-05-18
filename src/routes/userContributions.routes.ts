import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { listMyContributions } from "../controllers/groupContributionController";

const router = Router();
router.use(authenticate);

router.get("/mine", listMyContributions as RequestHandler);

export default router;
