import { Response } from "express";
import { AuthRequest } from "../middleware/auth.unified.middleware";
import Models from "../database/models";
import { Op } from "sequelize";

/**
 * Get all actions across all organizations (admin only)
 * GET /api/v1/admin/actions
 */
export const getAllActions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can access all actions",
      });
      return;
    }

    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      type = "",
      organizationId = "",
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 20);
    const normalizedSortBy = String(sortBy);
    const normalizedSortDirection =
      String(sortDirection).toLowerCase() === "asc" ? "asc" : "desc";

    const models = req.app.get("models") as ReturnType<typeof Models>;
    const whereClause: any = {};

    // Apply filters
    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (type && type !== "all") {
      whereClause.type = type;
    }

    if (organizationId && organizationId !== "all") {
      whereClause.organizationId = organizationId;
    }

    // Search in name, slug, or description
    if (search) {
      const { Op } = require("sequelize");
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { shortDescription: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Get actions with organization info
    const { count, rows: actions } = await models.Action.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.Organization,
          as: "organization",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [[normalizedSortBy, normalizedSortDirection]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    });

    // Get statistics - using separate queries
    const [draftCount, publishedCount, archivedCount] = await Promise.all([
      models.Action.count({ where: { status: "draft" } }),
      models.Action.count({ where: { status: "published" } }),
      models.Action.count({ where: { status: "archived" } }),
    ]);

    const statistics = {
      total: count,
      draft: draftCount,
      published: publishedCount,
      archived: archivedCount,
    };

    const totalPages = Math.ceil(count / pageSize);

    res.status(200).json({
      success: true,
      data: actions,
      statistics,
      pagination: {
        total: count,
        page: pageNumber,
        limit: pageSize,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get all actions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get action by ID (admin only)
 * GET /api/v1/admin/actions/:id
 */
export const getActionById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can access action details",
      });
      return;
    }

    const { id } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const action = await models.Action.findByPk(id, {
      include: [
        {
          model: models.Organization,
          as: "organization",
          attributes: ["id", "name", "email"],
        },
        {
          model: models.SubAction,
          as: "subActions",
        },
      ],
    });

    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: action,
    });
  } catch (error: any) {
    console.error("Get action by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Update action status (admin only)
 * PUT /api/v1/admin/actions/:id/status
 */
export const updateActionStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can update action status",
      });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["draft", "published", "archived"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const models = req.app.get("models") as ReturnType<typeof Models>;

    const action = await models.Action.findByPk(id);
    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    await action.update({ status });

    res.status(200).json({
      success: true,
      message: `Action ${status} successfully`,
      data: action,
    });
  } catch (error: any) {
    console.error("Update action status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Delete action (admin only)
 * DELETE /api/v1/admin/actions/:id
 */
export const deleteAction = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can delete actions",
      });
      return;
    }

    const { id } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const action = await models.Action.findByPk(id);
    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    // Check if action has purchases
    const purchaseCount = await models.ActionPurchase.count({
      where: { actionId: id },
    });

    if (purchaseCount > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete action with ${purchaseCount} purchase(s). Archive it instead.`,
      });
      return;
    }

    await action.destroy();

    res.status(200).json({
      success: true,
      message: "Action deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete action error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export default {
  getAllActions,
  getActionById,
  updateActionStatus,
  deleteAction,
};
