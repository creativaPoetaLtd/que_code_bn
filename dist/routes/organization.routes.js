"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("../middleware/multer"));
const orgController_1 = __importDefault(require("../controllers/orgController"));
const express_1 = __importDefault(require("express"));
const orgRouter = express_1.default.Router();
orgRouter.post("/register", multer_1.default.fields([
    { name: "logo", maxCount: 1 },
    { name: "operationalDocument", maxCount: 1 },
]), orgController_1.default.create_org);
orgRouter.get("/", orgController_1.default.get_all_orgs);
orgRouter.get("/:id", orgController_1.default.get_org_by_id);
orgRouter.put("/:id", orgController_1.default.update_org);
orgRouter.delete("/:id", orgController_1.default.delete_org);
orgRouter.put("/:id/approve", orgController_1.default.update_org_approval);
orgRouter.get("/approved", orgController_1.default.get_approved_orgs);
orgRouter.get("/unapproved", orgController_1.default.get_unapproved_orgs);
exports.default = orgRouter;
