import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import resetRouter from "./reset.routes";
import transactionRouter from "./transaction.routes";
import analyticsRouter from "./analytics.routes";
import contactRouter from "./contact.routes";
import contactInvitationRouter from "./contactInvitation.routes";
import organizationCategoryRouter from "./organizationCategory.routes";
import profileRouter from "./profile.routes";
import groupRouter from "./group.routes";
import notificationRouter from "./notification.routes";
import pinRouter from "./pin.routes";
import chatRouter from "./chat.routes";
import actionRouter from "./action.routes";

import fcmRouter from "./fcm.routes";

// Admin routes (separate authentication)
import adminAuthRouter from "./admin.auth.routes";
import adminRouter from "./admin.routes";

const router = express.Router();

// ============================================
// USER/PUBLIC ROUTES
// ============================================
router.use("/organizations", orgRouter);
router.use("/organization-categories", organizationCategoryRouter);
router.use("/profiles", profileRouter);
router.use("/users", userRouter);
router.use("/users/pin", pinRouter);
router.use("/auth", resetRouter);
router.use("/transactions", transactionRouter);
router.use("/analytics", analyticsRouter);
router.use("/contacts", contactRouter);
router.use("/contact-invitations", contactInvitationRouter);
router.use("/groups", groupRouter);
router.use("/notifications", notificationRouter);
router.use("/chats", chatRouter);
router.use("/fcm", fcmRouter);
router.use("", actionRouter); 
router.use("/admin/auth", adminAuthRouter);  
router.use("/admin", adminRouter);   
export default router;
