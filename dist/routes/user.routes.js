"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("../middleware/multer"));
const userController_1 = __importDefault(require("../controllers/userController"));
const express_1 = __importDefault(require("express"));
const userRouter = express_1.default.Router();
userRouter.post("/register", multer_1.default.fields([
    { name: "national_id", maxCount: 1 }
]), userController_1.default.create_user);
userRouter.get("/", userController_1.default.get_all_users);
userRouter.get("/:id", userController_1.default.get_user_by_id);
userRouter.put("/:id", userController_1.default.update_user);
userRouter.delete("/:id", userController_1.default.delete_user);
userRouter.put("/:id/approve", userController_1.default.approve_user);
userRouter.put("/:id/disapprove", userController_1.default.disapprove_user);
userRouter.get("/approved", userController_1.default.get_approved_users);
userRouter.get("/unapproved", userController_1.default.get_unapproved_users);
userRouter.post('/verify-otp', userController_1.default.verify_otp);
userRouter.post('/resend-otp', userController_1.default.resend_otp);
exports.default = userRouter;
