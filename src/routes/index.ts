import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import loginRouter from "./login.routes";
import resetRouter from "./reset.routes";
// import transactionRouter from "./transaction.routes"; // Temporarily disabled
import contactRouter from "./contact.routes";
// import contactInvitationRouter from "./contactInvitation.routes"; // Temporarily disabled
import organizationCategoryRouter from "./organizationCategory.routes";
import profileRouter from "./profile.routes";
import groupRouter from "./group.routes";
import notificationRouter from "./notification.routes"; // Re-enabled

const router = express.Router();
router.use("/organizations", orgRouter);
router.use("/organization-categories", organizationCategoryRouter);
router.use("/profiles", profileRouter);
router.use("/users", userRouter);
router.use("/auth", loginRouter);
router.use("/auth", resetRouter);
// router.use("/transactions", transactionRouter); // Temporarily disabled

router.use("/contacts", contactRouter);
// router.use("/contact-invitations", contactInvitationRouter); // Temporarily disabled
router.use("/groups", groupRouter); // Re-enabled after fixing compilation errors
router.use("/notifications", notificationRouter); // Re-enabled
export default router;
