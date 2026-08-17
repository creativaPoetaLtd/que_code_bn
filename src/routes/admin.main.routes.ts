import express from "express";
import userRouter from "./user.routes";
import roleRouter from "./role.routes";
import permissionRouter from "./permission.routes";
import transactionRouter from "./transaction.routes";
import actionRouter from "./admin.action.routes";
import adminGroupsRouter from "./admin.groups.routes";
import adminWalletsRouter from "./admin.wallets.routes";
import adminNotificationsRouter from "./admin.notifications.routes";
import adminAnalyticsRouter from "./admin.analytics.routes";
import adminSupportRouter from "./admin.support.routes";
import adminEscrowDisputesRouter from "./admin.escrowDisputes.routes";

const router = express.Router();

router.use("/users", userRouter);
router.use("/roles", roleRouter);
router.use("/permissions", permissionRouter);
router.use("/transactions", transactionRouter);
router.use("/actions", actionRouter);
router.use("/groups", adminGroupsRouter);
router.use("/wallets", adminWalletsRouter);
router.use("/notifications", adminNotificationsRouter);
router.use("/analytics", adminAnalyticsRouter);
router.use("/support", adminSupportRouter);
router.use("/escrow-disputes", adminEscrowDisputesRouter);

export default router;
