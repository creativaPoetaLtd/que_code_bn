import { RequestHandler, Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware";
import * as publicContributionController from "../controllers/publicContributionController";

const router = Router();

// Public: look up a campaign by the group linked to it (for group chat banner)
router.get(
  "/by-group/:groupId",
  optionalAuthenticate as RequestHandler,
  publicContributionController.getContributionByGroup as RequestHandler
);

// Public: anyone can view a campaign (isCreator / myPayment only set when authenticated)
router.get(
  "/:contributionId",
  optionalAuthenticate as RequestHandler,
  publicContributionController.getContribution as RequestHandler
);

// Public: anyone can view linked group info (isUserMember only set when authenticated)
router.get(
  "/:contributionId/group",
  optionalAuthenticate as RequestHandler,
  publicContributionController.getLinkedGroup as RequestHandler
);

// All routes below require authentication
router.use(authenticate as RequestHandler);

// Creator: create a public campaign
router.post("/", publicContributionController.createContribution as RequestHandler);

// Creator: list own campaigns
router.get("/", publicContributionController.listMyContributions as RequestHandler);

// Any authenticated user: pay into a campaign
router.post("/:contributionId/pay", publicContributionController.contribute as RequestHandler);

// Creator: edit a campaign (title, note, goalAmount, visibility, disbursementPolicy)
router.patch("/:contributionId", publicContributionController.updateContribution as RequestHandler);

// Creator: close campaign early
router.patch("/:contributionId/close", publicContributionController.closeContribution as RequestHandler);

// Creator: extend deadline (also reactivates expired campaigns)
router.patch("/:contributionId/extend", publicContributionController.extendDeadline as RequestHandler);

// Creator: withdraw collected funds (hold policy only)
router.post("/:contributionId/withdraw", publicContributionController.withdrawFunds as RequestHandler);

// Any authenticated user: list contributors (respects visibilityMode)
router.get("/:contributionId/contributors", publicContributionController.listContributors as RequestHandler);

// Creator: create a community group linked to this campaign
router.post("/:contributionId/group", publicContributionController.createLinkedGroup as RequestHandler);

// Any authenticated user: join the linked group
router.post("/:contributionId/join-group", publicContributionController.joinLinkedGroup as RequestHandler);

export default router;
