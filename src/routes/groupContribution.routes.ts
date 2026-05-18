import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as groupContributionController from "../controllers/groupContributionController";

const router = Router({ mergeParams: true });
router.use(authenticate);

// Admin: create a contribution campaign
router.post(
  "/",
  groupContributionController.createContribution as RequestHandler
);

// Admin: close a campaign early
router.patch(
  "/:contributionId/close",
  groupContributionController.closeContribution as RequestHandler
);

// Admin: extend the deadline (also reactivates expired campaigns)
router.patch(
  "/:contributionId/extend",
  groupContributionController.extendDeadline as RequestHandler
);

// Member: pay into a campaign
router.post(
  "/:contributionId/pay",
  groupContributionController.contribute as RequestHandler
);

// All active members: list all campaigns for a group
router.get(
  "/",
  groupContributionController.listContributions as RequestHandler
);

// All active members: get a single campaign with full detail
router.get(
  "/:contributionId",
  groupContributionController.getContribution as RequestHandler
);

export default router;
