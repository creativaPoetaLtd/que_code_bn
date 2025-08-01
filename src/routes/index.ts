import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import loginRouter from "./login.routes";
import resetRouter from "./reset.routes";
import transactionRouter from "./transaction.routes";
const router = express.Router();
router.use("/organizations", orgRouter);
router.use("/users", userRouter);
router.use("/auth", loginRouter);
router.use("/auth", resetRouter);
router.use("/transactions", transactionRouter);


export default router;