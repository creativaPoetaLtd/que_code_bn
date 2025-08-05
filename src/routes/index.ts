import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import loginRouter from "./login.routes";
import resetRouter from "./reset.routes";
import transactionRouter from "./transaction.routes";
import contactRouter from "./contact.routes";
import groupRouter from "./group.routes";
import notificationRouter from "./notification.routes";

const router = express.Router();
router.use("/organizations", orgRouter);
router.use("/users", userRouter);
router.use("/auth", loginRouter);
router.use("/auth", resetRouter);
router.use("/transactions", transactionRouter);


router.use("/contacts", contactRouter);
router.use("/groups", groupRouter);
router.use("/notifications", notificationRouter);
export default router;