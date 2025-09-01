import express from "express";
import orgRouter from "./organization.routes";
import userRouter from "./user.routes";
import loginRouter from "./login.routes";
import resetRouter from "./reset.routes";
// import transactionRouter from "./transaction.routes"; // Temporarily disabled
// import contactRouter from "./contact.routes"; // Temporarily disabled
// import contactInvitationRouter from "./contactInvitation.routes"; // Temporarily disabled
import organizationCategoryRouter from "./organizationCategory.routes";
import profileRouter from "./profile.routes";
// import groupRouter from "./group.routes"; // Temporarily disabled due to compilation errors
// import notificationRouter from "./notification.routes"; // Temporarily disabled

const router = express.Router();
router.use("/organizations", orgRouter);
router.use("/organization-categories", organizationCategoryRouter);
router.use("/profiles", profileRouter);
router.use("/users", userRouter);
router.use("/auth", loginRouter);
router.use("/auth", resetRouter);
// router.use("/transactions", transactionRouter); // Temporarily disabled

// router.use("/contacts", contactRouter); // Temporarily disabled
// router.use("/contact-invitations", contactInvitationRouter); // Temporarily disabled
// router.use("/groups", groupRouter); // Temporarily disabled due to compilation errors
// router.use("/notifications", notificationRouter); // Temporarily disabled
export default router;
