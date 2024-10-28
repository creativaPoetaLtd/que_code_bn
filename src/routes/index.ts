import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import loginRouter from "./login.routes";
const router = express.Router();
router.use("/organizations", orgRouter);
router.use("/users", userRouter);
router.use("/auth", loginRouter);

export default router;