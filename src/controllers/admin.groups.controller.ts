import { Request, Response, RequestHandler } from "express";
import Models from "../database/models";
import { Op } from "sequelize";

// GET /api/v1/admin/groups
// Returns all groups with optional wallet info, pagination, search
export const getAllGroups: RequestHandler = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      hasFundraising,
      privacyType,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (hasFundraising === "true") whereClause.hasFundraising = true;
    if (hasFundraising === "false") whereClause.hasFundraising = false;
    if (privacyType && privacyType !== "all") whereClause.privacyType = privacyType;

    const { count, rows: groups } = await models.Group.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.Wallet,
          as: "wallet",
          required: false,
          attributes: ["id", "balance", "createdAt"],
        },
        {
          model: models.User,
          as: "owner",
          required: false,
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: groups,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching groups",
      error: error.message,
    });
  }
};

// DELETE /api/v1/admin/groups/:id
export const deleteGroup: RequestHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const group = await models.Group.findByPk(id);
    if (!group) {
      res.status(404).json({ success: false, message: "Group not found" });
      return;
    }

    // Delete wallet if group had one
    if (group.walletId) {
      await models.Wallet.destroy({ where: { id: group.walletId } });
    }

    await group.destroy();

    res.status(200).json({ success: true, message: "Group deleted successfully" });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting group",
      error: error.message,
    });
  }
};

// GET /api/v1/admin/groups/:id/members
export const getGroupMembers: RequestHandler = async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id as string;
    const { page = 1, limit = 20, role, status = "active" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const group = await models.Group.findByPk(groupId, {
      attributes: ["id", "name", "memberCount", "ownerId"],
    });
    if (!group) {
      res.status(404).json({ success: false, message: "Group not found" });
      return;
    }

    const whereClause: any = { groupId };
    if (status && status !== "all") whereClause.status = status;
    if (role && role !== "all") whereClause.role = role;

    const { count, rows: members } = await models.GroupMember.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "user",
          required: false,
          attributes: ["id", "firstName", "lastName", "email", "isVerified", "isOnline", "lastSeen"],
        },
      ],
      limit: Number(limit),
      offset,
      order: [["joinedAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      group: { id: group.id, name: group.name, memberCount: group.memberCount },
      data: members,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching group members", error: error.message });
  }
};

// DELETE /api/v1/admin/groups/:id/members/:userId
export const removeGroupMember: RequestHandler = async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id as string;
    const userId = req.params.userId as string;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const member = await models.GroupMember.findOne({ where: { groupId, userId } });
    if (!member) {
      res.status(404).json({ success: false, message: "Member not found in this group" });
      return;
    }
    if (member.role === "owner") {
      res.status(400).json({ success: false, message: "Cannot remove the group owner" });
      return;
    }

    await member.update({ status: "removed" });

    // Decrement memberCount
    await models.Group.decrement("memberCount", { where: { id: groupId } });

    res.status(200).json({ success: true, message: "Member removed from group" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error removing member", error: error.message });
  }
};

export default { getAllGroups, deleteGroup, getGroupMembers, removeGroupMember };
