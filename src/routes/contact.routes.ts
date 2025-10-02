import { Router } from "express";
import {
  get_user_contacts,
  remove_contact,
  get_user_profile_info,
} from "../controllers/contactController";
import { authenticate } from "../middleware/auth.middleware";

const contactRouter = Router();

// Get current user's profile info (for sharing profile URL)
contactRouter.get("/profile", authenticate, get_user_profile_info);

// Get current user's contacts
contactRouter.get("/", authenticate, get_user_contacts);

// Remove contact
contactRouter.delete("/:contactUserId", authenticate, remove_contact);

export default contactRouter;
