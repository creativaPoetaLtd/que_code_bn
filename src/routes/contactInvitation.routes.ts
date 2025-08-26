import { Router } from "express";
import contactInvitationController from "../controllers/contactInvitationController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Send contact invitation
router.post("/", contactInvitationController.send_invitation);

// Respond to invitation (accept/decline)
router.post("/:id/respond", contactInvitationController.respond_to_invitation);

// Get received invitations
router.get("/received", contactInvitationController.get_received_invitations);

// Get sent invitations
router.get("/sent", contactInvitationController.get_sent_invitations);

// Cancel pending invitation
router.delete("/:id", contactInvitationController.cancel_invitation);

export default router;
