import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as contactController from "../controllers/contactController";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Search users for potential contacts
router.get("/search", contactController.search_users as RequestHandler);

// Get contact statistics
router.get("/stats", contactController.get_contact_stats as RequestHandler);

// Get current user's contacts
router.get("/", contactController.get_user_contacts as RequestHandler);

// Get contact by ID
router.get("/:id", contactController.get_contact_by_id as RequestHandler);

// Create a new contact
router.post("/", contactController.create_contact as RequestHandler);

// Update contact status (block/unblock)
router.put("/:id", contactController.update_contact_status as RequestHandler);

// Remove contact
router.delete("/:id", contactController.remove_contact as RequestHandler);

export default router;
