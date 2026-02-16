import fileUpload from "../middleware/multer";
import userController from "../controllers/userController";
import {
  authenticate,
  requireRole,
  requirePermission,
} from "../middleware/auth.unified.middleware";
import express, { RequestHandler } from "express";

const userRouter = express.Router();

// Public routes
userRouter.post(
  "/register",
  fileUpload.fields([{ name: "national_id", maxCount: 1 }]),
  userController.create_user
);
userRouter.get("/verify", userController.verify_user_email); // GET for direct links
userRouter.post("/verify", userController.verify_user_email); // POST for manual OTP entry
userRouter.post("/resend-verification", userController.resend_verification);

// Admin-only routes (must come before /:id to avoid route conflicts)
userRouter.get(
  "/admin/statistics",
  authenticate as RequestHandler,
  requireRole("admin", "super_admin") as RequestHandler,
  userController.get_user_statistics
);
userRouter.get(
  "/admin/approved",
  authenticate as RequestHandler,
  requirePermission("view_users") as RequestHandler,
  userController.get_approved_users
);
userRouter.get(
  "/admin/unapproved",
  authenticate as RequestHandler,
  requirePermission("view_users") as RequestHandler,
  userController.get_unapproved_users
);
userRouter.get(
  "/",
  authenticate as RequestHandler,
  requirePermission("view_users") as RequestHandler,
  userController.get_all_users_admin
);

// Assign role to user (Admin only)
userRouter.post(
  "/assign-role",
  authenticate as RequestHandler,
  requirePermission("assign_roles") as RequestHandler,
  userController.assign_role_to_user
);

// Protected routes - General user access
userRouter.get(
  "/:id",
  authenticate as RequestHandler,
  userController.get_user_by_id
);
userRouter.put(
  "/:id",
  authenticate as RequestHandler,
  fileUpload.fields([{ name: "profileImage", maxCount: 1 }]),
  userController.update_user
);
userRouter.put(
  "/:id/status",
  authenticate as RequestHandler,
  requirePermission("edit_users") as RequestHandler,
  userController.update_user_status
);
userRouter.put(
  "/:id/approve",
  authenticate as RequestHandler,
  requirePermission("approve_users") as RequestHandler,
  userController.approve_user
);
userRouter.put(
  "/:id/disapprove",
  authenticate as RequestHandler,
  requirePermission("approve_users") as RequestHandler,
  userController.disapprove_user
);
userRouter.delete(
  "/:id",
  authenticate as RequestHandler,
  requireRole("admin", "super_admin") as RequestHandler,
  userController.delete_user
);

export default userRouter;
