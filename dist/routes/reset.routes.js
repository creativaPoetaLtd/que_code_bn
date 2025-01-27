"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const reset_password_1 = __importDefault(require("../auth/reset_password"));
const express_1 = __importDefault(require("express"));
const resetRouter = express_1.default.Router();
resetRouter.post('/forgot-password', reset_password_1.default.forgotPassword);
resetRouter.post('/reset-password', reset_password_1.default.resetPassword);
exports.default = resetRouter;
