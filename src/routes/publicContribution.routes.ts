import { RequestHandler, Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware";
import * as publicContributionController from "../controllers/publicContributionController";

const router = Router();

// Public: anyone can view a campaign (isCreator / myPayment only set when authenticated)
router.get(
  "/:contributionId",
  optionalAuthenticate as RequestHandler,
  publicContributionController.getContribution as RequestHandler
);

// All routes below require authentication
router.use(authenticate as RequestHandler);

// Creator: create a public campaign
router.post("/", publicContributionController.createContribution as RequestHandler);

// Creator: list own campaigns
router.get("/", publicContributionController.listMyContributions as RequestHandler);

// Any authenticated user: pay into a campaign
router.post("/:contributionId/pay", publicContributionController.contribute as RequestHandler);

// Creator: close campaign early
router.patch("/:contributionId/close", publicContributionController.closeContribution as RequestHandler);

// Creator: extend deadline (also reactivates expired campaigns)
router.patch("/:contributionId/extend", publicContributionController.extendDeadline as RequestHandler);

// Creator: withdraw collected funds (hold policy only)
router.post("/:contributionId/withdraw", publicContributionController.withdrawFunds as RequestHandler);

export default router;
