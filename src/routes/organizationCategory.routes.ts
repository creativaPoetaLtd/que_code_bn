import { Router } from "express";
import {
  create_category,
  get_all_categories,
  get_category_by_id,
  update_category,
  delete_category,
} from "../controllers/organizationCategoryController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Get all organization categories (public route)
router.get("/", get_all_categories);

// Get organization category by ID (public route)
router.get("/:id", get_category_by_id);

// Create organization category (public route - no authentication required)
router.post("/", create_category);

// Protected routes (require authentication)
router.use(authenticate);

// Update organization category
router.put("/:id", update_category);

// Delete organization category
router.delete("/:id", delete_category);

export default router;
