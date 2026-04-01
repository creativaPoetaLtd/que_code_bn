import express, { RequestHandler } from "express";
import { getAllGroups, deleteGroup, getGroupMembers, removeGroupMember } from "../controllers/admin.groups.controller";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();

const guard = [authenticate as RequestHandler, requireRole("admin", "super_admin") as RequestHandler];

// GET  /api/v1/admin/groups
router.get("/", ...guard, getAllGroups);

// DELETE /api/v1/admin/groups/:id
router.delete("/:id", ...guard, deleteGroup);

// GET  /api/v1/admin/groups/:id/members
router.get("/:id/members", ...guard, getGroupMembers);

// DELETE /api/v1/admin/groups/:id/members/:userId
router.delete("/:id/members/:userId", ...guard, removeGroupMember);

export default router;
