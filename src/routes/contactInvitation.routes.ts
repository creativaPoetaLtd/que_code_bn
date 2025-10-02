import { Router } from "express";
import {
  send_contact_invitation,
  accept_contact_invitation,
  decline_contact_invitation,
  get_pending_invitations,
  get_sent_invitations,
  verify_invitation,
  accept_invitation_by_token,
  decline_invitation_by_token,
} from "../controllers/contactInvitationController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Send a contact invitation
router.post("/send", authenticate, send_contact_invitation);

// Accept a contact invitation
router.put("/:invitationId/accept", authenticate, accept_contact_invitation);

// Decline a contact invitation
router.put("/:invitationId/decline", authenticate, decline_contact_invitation);

// Get pending invitations (received)
router.get("/pending", authenticate, get_pending_invitations);

// Get sent invitations
router.get("/sent", authenticate, get_sent_invitations);

// Public routes for email link handling (no authentication required)
router.get("/verify/:token", verify_invitation);
router.post("/accept/:token", accept_invitation_by_token);
router.post("/decline/:token", decline_invitation_by_token);

export default router;
