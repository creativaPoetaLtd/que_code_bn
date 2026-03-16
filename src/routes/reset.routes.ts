import resetPassword from "../auth/reset_password";
import express from "express";

const resetRouter = express.Router();

resetRouter.post("/forgot-password", resetPassword.forgotPassword);
resetRouter.post("/reset-password", resetPassword.resetPassword);
resetRouter.post("/set-account-password", resetPassword.setAccountPassword);

export default resetRouter;
