import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as sharedWalletController from "../controllers/sharedWalletController";

const router = Router();
router.use(authenticate);

// Creation + listing
router.post("/", sharedWalletController.createSharedWallet as RequestHandler);
router.get("/", sharedWalletController.listMySharedWallets as RequestHandler);
// Must come before "/:id" so Express doesn't match :id = "invitations".
router.get("/invitations/pending", sharedWalletController.getPendingSharedWalletInvitations as RequestHandler);
router.get("/:id", sharedWalletController.getSharedWalletById as RequestHandler);

// Money movement
router.post("/:id/deposit", sharedWalletController.deposit as RequestHandler);
router.post("/:id/withdraw", sharedWalletController.withdrawFree as RequestHandler);
router.post("/:id/withdrawals", sharedWalletController.proposeWithdrawal as RequestHandler);
router.post("/:id/withdrawals/:wid/approve", sharedWalletController.approveWithdrawal as RequestHandler);
router.post("/:id/withdrawals/:wid/decline", sharedWalletController.declineWithdrawal as RequestHandler);
router.post("/:id/withdrawals/:wid/cancel", sharedWalletController.cancelWithdrawal as RequestHandler);
router.get("/:id/withdrawals/:wid", sharedWalletController.getWithdrawalById as RequestHandler);

// Activity + membership
router.get("/:id/activity", sharedWalletController.getActivity as RequestHandler);
router.get("/:id/members", sharedWalletController.listMembers as RequestHandler);
router.get("/:id/pending-members", sharedWalletController.listPendingMembers as RequestHandler);
router.post("/:id/members", sharedWalletController.addMember as RequestHandler);
router.post("/:id/invitations/:membershipId/respond", sharedWalletController.respondToSharedWalletInvitation as RequestHandler);
router.delete("/:id/members/:userId", sharedWalletController.removeMember as RequestHandler);
router.post("/:id/leave", sharedWalletController.leaveSharedWallet as RequestHandler);
router.post("/:id/transfer-ownership", sharedWalletController.transferOwnership as RequestHandler);
router.delete("/:id", sharedWalletController.deleteSharedWallet as RequestHandler);

// Withdrawal policy changes
router.patch("/:id/policy", sharedWalletController.updateWithdrawalPolicyInstant as RequestHandler);
router.get("/:id/policy-changes/pending", sharedWalletController.getPendingPolicyChange as RequestHandler);
router.post("/:id/policy-changes", sharedWalletController.proposePolicyChange as RequestHandler);
router.post("/:id/policy-changes/:pcid/approve", sharedWalletController.approvePolicyChange as RequestHandler);
router.post("/:id/policy-changes/:pcid/decline", sharedWalletController.declinePolicyChange as RequestHandler);
router.post("/:id/policy-changes/:pcid/cancel", sharedWalletController.cancelPolicyChange as RequestHandler);

export default router;
