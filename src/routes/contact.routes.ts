import { Router } from "express";
import {
  get_user_contacts,
  remove_contact,
  get_available_users,
} from "../controllers/contactController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Get available users (for invitation purposes)
router.get("/available", authenticate, get_available_users);

// Get current user's contacts
router.get("/", authenticate, get_user_contacts);

// Remove contact
router.delete("/:contactUserId", authenticate, remove_contact);

export default router;
