import { organizationFileUpload } from "../middleware/multer";
import orgController from "../controllers/orgController";
import express from "express";

const orgRouter = express.Router();

// Error handling middleware for multer
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof Error) {
    if (err.message.includes('File type')) {
      return res.status(400).json({
        message: "Invalid file type",
        error: err.message
      });
    }
    if ((err as any).code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: "File too large",
        error: "File size must be less than 10MB"
      });
    }
    if ((err as any).code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: "Too many files",
        error: "Maximum 2 files allowed (logo and operational document)"
      });
    }
  }
  next(err);
};

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
