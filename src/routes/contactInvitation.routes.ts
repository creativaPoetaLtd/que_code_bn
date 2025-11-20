import { Router } from "express";
import contactInvitationController from "../controllers/contactInvitationController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public endpoints (no authentication required)
// Get invitation by token (for viewing invitation details)
router.get("/token/:token", contactInvitationController.get_invitation_by_token);

// Respond to invitation by token (public, for email/QR links)
router.post("/token/:token/respond", contactInvitationController.respond_to_invitation_by_token);

// All other routes require authentication
router.use(authenticate);

// Send contact invitation
router.post("/", contactInvitationController.send_invitation);

// Send contact invitation by public ID (for QR code scans)
router.post("/by-public-id", contactInvitationController.send_invitation_by_public_id);

// Respond to invitation by ID (authenticated)
router.post("/:id/respond", contactInvitationController.respond_to_invitation);

// Get received invitations
router.get("/received", contactInvitationController.get_received_invitations);

// Get sent invitations
router.get("/sent", contactInvitationController.get_sent_invitations);

// Cancel pending invitation
router.delete("/:id", contactInvitationController.cancel_invitation);

export default router;
