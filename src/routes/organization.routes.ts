import { organizationFileUpload } from "../middleware/multer";
import orgController from "../controllers/orgController";
import express from "express";
import {
  authenticate,
  requirePermission,
} from "../middleware/auth.unified.middleware";

const orgRouter = express.Router();

// Error handling middleware for multer
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof Error) {
    if (err.message.includes("File type")) {
      return res.status(400).json({
        message: "Invalid file type",
        error: err.message,
      });
    }
    if ((err as any).code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File too large",
        error: "File size must be less than 10MB",
      });
    }
    if ((err as any).code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "Too many files",
        error: "Maximum 2 files allowed (logo and operational document)",
      });
    }
  }
  next(err);
};

// Admin create organization (must come before general POST route)
orgRouter.post(
  "/admin/create",
  authenticate as any,
  requirePermission("create_organizations") as any,
  orgController.admin_create_organization,
);

// Create organization (standard REST endpoint)
orgRouter.post("/", orgController.create_organization);

// Get all organizations
orgRouter.get("/", orgController.get_all_organizations);

// Legacy register endpoint (keeping for backward compatibility)
orgRouter.post("/register", orgController.create_organization);

// Specific routes (should come before parameterized routes)
orgRouter.get("/active", orgController.get_active_organizations);
orgRouter.get("/pending", orgController.get_pending_organizations);
orgRouter.get("/verify", orgController.verify_organization_email_token);

// Parameterized routes (should come last)
orgRouter.get("/:id", orgController.get_organization_by_id);
orgRouter.get("/:id/category", orgController.get_organization_category);
orgRouter.put("/:id", orgController.update_organization);
orgRouter.delete("/:id", orgController.delete_organization);
orgRouter.put("/:id/activate", orgController.activate_organization);
orgRouter.put("/:id/deactivate", orgController.deactivate_organization);
orgRouter.put("/:id/suspend", orgController.suspend_organization);

export default orgRouter;
