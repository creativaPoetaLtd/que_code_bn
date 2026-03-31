import express, { RequestHandler } from "express";
import { getAllGroups, deleteGroup } from "../controllers/admin.groups.controller";
import { authenticate, requireRole } from "../middleware/auth.unified.middleware";

const router = express.Router();

// GET /api/v1/admin/groups - list all groups with wallets
router.get(
  "/",
  authenticate as RequestHandler,
  requireRole("admin", "super_admin") as RequestHandler,
  getAllGroups,
);

// DELETE /api/v1/admin/groups/:id - delete a group
router.delete(
  "/:id",
  authenticate as RequestHandler,
  requireRole("admin", "super_admin") as RequestHandler,
  deleteGroup,
);

export default router;
