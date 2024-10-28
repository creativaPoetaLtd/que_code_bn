import fileUpload from "../middleware/multer";
import userController from "../controllers/userController";
import express from "express";

const userRouter = express.Router();
userRouter.post(
  "/register",
  fileUpload.fields([
    { name: "national_id", maxCount: 1 }
  ]),
  userController.create_user
);

userRouter.get("/", userController.get_all_users);
userRouter.get("/:id", userController.get_user_by_id);
userRouter.put("/:id", userController.update_user);
userRouter.delete("/:id", userController.delete_user);
userRouter.put("/:id/approve", userController.approve_user);
userRouter.put("/:id/disapprove", userController.disapprove_user);
userRouter.get("/approved", userController.get_approved_users);
userRouter.get("/unapproved", userController.get_unapproved_users);

export default userRouter;

