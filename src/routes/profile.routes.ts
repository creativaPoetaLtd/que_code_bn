import express from "express";
import profileController from "../controllers/profileController";
import fileUpload from "../middleware/multer";

const profileRouter = express.Router();

profileRouter.get("/", profileController.get_profile);
profileRouter.get("/all", profileController.get_all_profiles);
profileRouter.get("/:id", profileController.get_profile_by_id);
profileRouter.put(
  "/:id",
  fileUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "operationalDocument", maxCount: 1 },
  ]),
  profileController.update_profile
);

export default profileRouter;
