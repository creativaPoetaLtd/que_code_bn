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
    const [draftCount, publishedCount, archivedCount, suspendedCount] =
      await Promise.all([
        models.Action.count({ where: { status: "draft" } }),
        models.Action.count({ where: { status: "published" } }),
        models.Action.count({ where: { status: "archived" } }),
        models.Action.count({ where: { status: "suspended" } }),
      ]);

    const statistics = {
      total: count,
      draft: draftCount,
      published: publishedCount,
      archived: archivedCount,
      suspended: suspendedCount,
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

/**
 * Suspend action (admin only - for unlawful/problematic actions)
 * PUT /api/v1/admin/actions/:id/suspend
 */
export const suspendAction = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can suspend actions",
      });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    const models = req.app.get("models") as ReturnType<typeof Models>;

    const action = await models.Action.findByPk(id);
    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    if (action.status === "suspended") {
      res.status(400).json({
        success: false,
        message: "Action is already suspended",
      });
      return;
    }

    await action.update({ status: "suspended" });

    res.status(200).json({
      success: true,
      message: "Action suspended successfully",
      data: {
        action,
        reason: reason || "No reason provided",
      },
    });
  } catch (error: any) {
    console.error("Suspend action error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Unsuspend action (admin only - restore suspended action)
 * PUT /api/v1/admin/actions/:id/unsuspend
 */
export const unsuspendAction = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can unsuspend actions",
      });
      return;
    }

    const { id } = req.params;
    const { newStatus } = req.body;

    const models = req.app.get("models") as ReturnType<typeof Models>;

    const action = await models.Action.findByPk(id);
    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    if (action.status !== "suspended") {
      res.status(400).json({
        success: false,
        message: "Action is not suspended",
      });
      return;
    }

    // Default to draft when unsuspending, or use provided status
    const targetStatus = newStatus || "draft";
    const validStatuses = ["draft", "published"];

    if (!validStatuses.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        message: "Can only unsuspend to draft or published status",
      });
      return;
    }

    await action.update({ status: targetStatus });

    res.status(200).json({
      success: true,
      message: `Action unsuspended and set to ${targetStatus}`,
      data: action,
    });
  } catch (error: any) {
    console.error("Unsuspend action error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get sub-actions for a specific action (admin only)
 * GET /api/v1/admin/actions/:id/sub-actions
 */
export const getActionSubActions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only admins can view sub-actions",
      });
      return;
    }

    const { id } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // First verify action exists
    const action = await models.Action.findByPk(id);
    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found",
      });
      return;
    }

    // Get all sub-actions for this action
    const subActions = await models.SubAction.findAll({
      where: { actionId: id },
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Calculate statistics
    const statistics = {
      total: subActions.length,
      active: subActions.filter((sa: any) => sa.isActive).length,
      inactive: subActions.filter((sa: any) => !sa.isActive).length,
      withStock: subActions.filter((sa: any) => sa.stock !== null).length,
      unlimited: subActions.filter((sa: any) => sa.stock === null).length,
      soldOut: subActions.filter(
        (sa: any) => sa.stock !== null && sa.stock <= sa.stockReserved,
      ).length,
    };

    res.status(200).json({
      success: true,
      data: subActions,
      statistics,
      action: {
        id: action.id,
        name: action.name,
        type: action.type,
        status: action.status,
      },
    });
  } catch (error: any) {
    console.error("Get action sub-actions error:", error);
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
  suspendAction,
  unsuspendAction,
  getActionSubActions,
};
