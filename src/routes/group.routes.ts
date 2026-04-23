// Notification endpoints (must be after router is declared)
import { RequestHandler, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validateGroupCreation, validateGroupInvitation, validateGroupResponse } from "../middleware/group.middleware";
import { uploadGroupProfilePicture } from "../middleware/upload.middleware";
import * as groupController from "../controllers/groupController";
import * as groupInvitationController from "../controllers/groupInvitationController";


const router = Router();
router.use(authenticate);

// Group management endpoints
router.post("/", 
    uploadGroupProfilePicture, 
    validateGroupCreation as RequestHandler[], 
    groupController.createGroup as RequestHandler
);
router.get("/", groupController.getUserGroups as RequestHandler);
router.get("/:groupId", groupController.getGroupDetails as RequestHandler);
router.put("/:groupId", 
    uploadGroupProfilePicture,
    groupController.updateGroup as RequestHandler
);
router.delete("/:groupId", groupController.deleteGroup as RequestHandler);

//Member management endpoints
router.get("/:groupId/members/search", groupController.searchGroupMembers as RequestHandler);
router.get("/:groupId/members", groupController.getGroupMembers as RequestHandler);
router.post("/invite", validateGroupInvitation as RequestHandler[], groupController.inviteToGroup as RequestHandler);
router.post("/respond/:membershipId", validateGroupResponse as RequestHandler[], groupController.respondToGroupInvitation as RequestHandler);
router.post("/:groupId/leave", groupController.leaveGroup as RequestHandler);
router.delete("/:groupId/members/:memberId", groupController.removeMember as RequestHandler);

// Join requests and invitations
router.post('/:groupId/requests', groupController.requestToJoinGroup as RequestHandler);
router.get('/:groupId/requests', groupController.getJoinRequests as RequestHandler);
router.post("/join", groupController.joinGroupByLink as RequestHandler);
router.post('/:groupId/requests/:requestId/respond', groupController.respondToJoinRequest as RequestHandler);

// Enhanced invitation management
router.get("/invitations/pending", groupInvitationController.getPendingInvitations as RequestHandler);
router.get("/requests/pending", groupInvitationController.getPendingJoinRequests as RequestHandler);
router.post("/requests/:requestId/respond", groupInvitationController.respondToJoinRequest as RequestHandler);
router.post("/requests/bulk-respond", groupInvitationController.bulkRespondToJoinRequests as RequestHandler);


export default router;