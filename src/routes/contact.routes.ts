import { Router } from "express";
import contactController from "../controllers/contactController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Search users for potential contacts
router.get("/search", contactController.search_users);

// Get current user's contacts
router.get("/", contactController.get_user_contacts);

// Get contact by ID
router.get("/:id", contactController.get_contact_by_id);

// Update contact status (block/unblock)
router.put("/:id", contactController.update_contact_status);

// Remove contact
router.delete("/:id", contactController.remove_contact);

export default router;
