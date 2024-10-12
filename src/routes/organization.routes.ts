import fileUpload from "../middleware/multer";
import orgController from "../controllers/orgController";
import express from "express";

const orgRouter = express.Router();
orgRouter.post(
  "/register",
  fileUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "operationalDocument", maxCount: 1 },
  ]),
  orgController.create_org
);

orgRouter.get("/", orgController.get_all_orgs);
orgRouter.get("/:id", orgController.get_org_by_id);
orgRouter.put("/:id", orgController.update_org);
orgRouter.delete("/:id", orgController.delete_org);
orgRouter.put("/:id/approve", orgController.update_org_approval);
orgRouter.get("/approved", orgController.get_approved_orgs);
orgRouter.get("/unapproved", orgController.get_unapproved_orgs);


export default orgRouter;
