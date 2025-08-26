import fileUpload from "../middleware/multer";
import orgController from "../controllers/orgController";
import express from "express";

const orgRouter = express.Router();

// Create organization (standard REST endpoint)
orgRouter.post("/", orgController.create_organization);

// Get all organizations
orgRouter.get("/", orgController.get_all_organizations);

// Legacy register endpoint (keeping for backward compatibility)
orgRouter.post("/register", orgController.create_organization);

// Specific routes (should come before parameterized routes)
orgRouter.get("/approved", orgController.get_approved_organizations);
orgRouter.get("/unapproved", orgController.get_unapproved_organizations);
orgRouter.get("/verify", orgController.verify_organization_email_token);

// Parameterized routes (should come last)
orgRouter.get("/:id", orgController.get_organization_by_id);
orgRouter.put("/:id", orgController.update_organization);
orgRouter.delete("/:id", orgController.delete_organization);
orgRouter.put("/:id/approve", orgController.approve_organization);
orgRouter.put("/:id/disapprove", orgController.disapprove_organization);

export default orgRouter;
