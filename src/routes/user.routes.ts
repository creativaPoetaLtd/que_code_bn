import fileUpload from "../middleware/multer";
import userController from "../controllers/userController";
import express from "express";
import { authenticate } from "../middleware/auth.middleware";

const userRouter = express.Router();
userRouter.post(
  "/register",
  fileUpload.fields([{ name: "national_id", maxCount: 1 }]),
  userController.create_user
);

userRouter.get("/", userController.get_all_users);
userRouter.get("/approved", userController.get_approved_users);
userRouter.get("/unapproved", userController.get_unapproved_users);
userRouter.get("/verify", userController.verify_user_email); // GET for direct links
userRouter.post("/verify", userController.verify_user_email); // POST for manual OTP entry
userRouter.post("/resend-verification", userController.resend_verification);
userRouter.get("/:id", userController.get_user_by_id);
userRouter.put(
  "/:id",
  fileUpload.fields([{ name: "profileImage", maxCount: 1 }]),
  userController.update_user
);
userRouter.delete("/:id", userController.delete_user);
userRouter.put("/:id/approve", userController.approve_user);
userRouter.put("/:id/disapprove", userController.disapprove_user);
userRouter.get("/me", authenticate, userController.get_current_user);
userRouter.get("/search", authenticate, userController.search_users);


export default userRouter;
