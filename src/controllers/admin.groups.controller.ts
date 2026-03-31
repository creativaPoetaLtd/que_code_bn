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

export default { getAllGroups, deleteGroup };
