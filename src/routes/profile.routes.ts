import express from "express";
import profileController from "../controllers/profileController";
import fileUpload, { galleryImageUpload } from "../middleware/multer";
import { authenticate } from "../middleware/auth.unified.middleware";
import { RequestHandler } from "express";

const profileRouter = express.Router();

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
  }
  next(err);
};

profileRouter.get("/", profileController.get_profile);
profileRouter.get("/all", profileController.get_all_profiles);
profileRouter.get("/:userId/gallery", profileController.get_profile_gallery);
profileRouter.post(
  "/:userId/gallery",
  authenticate as RequestHandler,
  galleryImageUpload.single("image"),
  handleMulterError,
  profileController.upload_profile_gallery_item
);
profileRouter.put(
  "/:userId/gallery/:itemId",
  authenticate as RequestHandler,
  galleryImageUpload.single("image"),
  handleMulterError,
  profileController.update_profile_gallery_item
);
profileRouter.delete(
  "/:userId/gallery/:itemId",
  authenticate as RequestHandler,
  profileController.delete_profile_gallery_item
);
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
