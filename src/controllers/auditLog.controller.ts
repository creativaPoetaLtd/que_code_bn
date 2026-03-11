import { Request, Response } from "express";
import { Op } from "sequelize";
import Models from "../database/models";

/**
 * Get all audit logs with filtering and pagination
 * Admin only endpoint
 */
export const getAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      level = "all",
      action = "all",
      userId = "",
      organizationId = "",
      startDate,
      endDate,
      method = "all",
      sortBy = "createdAt",
      sortDirection = "desc",
    } = req.query;

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(Math.max(1, Number(limit)), 200); // Max 200 items per page
    const offset = (pageNumber - 1) * pageSize;

    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Build where clause
    const whereClause: any = {};

    // Filter by level
    if (level !== "all") {
      whereClause.level = level;
    }

    // Filter by action
    if (action !== "all") {
      whereClause.action = action;
    }

    // Filter by HTTP method
    if (method !== "all") {
      whereClause.method = method;
    }

    // Filter by user
    if (userId) {
      whereClause.userId = userId;
    }

    // Filter by organization
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    // Filter by date range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    // Search filter (endpoint, action, ipAddress)
    if (search) {
      whereClause[Op.or] = [
        { endpoint: { [Op.iLike]: `%${search}%` } },
        { action: { [Op.iLike]: `%${search}%` } },
        { ipAddress: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Validate and normalize sort parameters
    const validSortFields = [
      "createdAt",
      "statusCode",
      "duration",
      "level",
      "action",
      "endpoint",
      "method",
    ];
    const normalizedSortBy = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : "createdAt";
    const normalizedSortDirection = sortDirection === "asc" ? "ASC" : "DESC";

    // Fetch audit logs with user and organization data
    const { count, rows: auditLogs } = await models.AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
          required: false,
        },
        {
          model: models.Organization,
          as: "organization",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [[normalizedSortBy, normalizedSortDirection]],
      limit: pageSize,
      offset,
    });

    // Get statistics
    const [
      totalLogs,
      infoCount,
      warningCount,
      errorCount,
      criticalCount,
      last24hCount,
      last7dCount,
    ] = await Promise.all([
      models.AuditLog.count(),
      models.AuditLog.count({ where: { level: "info" } }),
      models.AuditLog.count({ where: { level: "warning" } }),
      models.AuditLog.count({ where: { level: "error" } }),
      models.AuditLog.count({ where: { level: "critical" } }),
      models.AuditLog.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      models.AuditLog.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const statistics = {
      total: totalLogs,
      info: infoCount,
      warning: warningCount,
      error: errorCount,
      critical: criticalCount,
      last24h: last24hCount,
      last7d: last7dCount,
    };

    const totalPages = Math.ceil(count / pageSize);

    res.status(200).json({
      success: true,
      data: auditLogs,
      pagination: {
        currentPage: pageNumber,
        pageSize,
        totalItems: count,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
      statistics,
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching audit logs",
      error: error.message,
    });
  }
};

/**
 * Get audit log by ID
 */
export const getAuditLogById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const auditLog = await models.AuditLog.findByPk(id, {
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phone"],
        },
        {
          model: models.Organization,
          as: "organization",
          attributes: ["id", "name", "email", "ownerName"],
        },
      ],
    });

    if (!auditLog) {
      res.status(404).json({
        success: false,
        message: "Audit log not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: auditLog,
    });
  } catch (error: any) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching audit log",
      error: error.message,
    });
  }
};

/**
 * Get audit logs for a specific user
 */
export const getUserAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNumber - 1) * pageSize;

    const models = req.app.get("models") as ReturnType<typeof Models>;

    const { count, rows: auditLogs } = await models.AuditLog.findAndCountAll({
      where: { userId },
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(count / pageSize);

    res.status(200).json({
      success: true,
      data: auditLogs,
      pagination: {
        currentPage: pageNumber,
        pageSize,
        totalItems: count,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user audit logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user audit logs",
      error: error.message,
    });
  }
};

/**
 * Get available filter options
 */
export const getAuditLogFilters = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;

    // Get unique actions and methods
    const [actions, methods] = await Promise.all([
      models.AuditLog.findAll({
        attributes: ["action"],
        group: ["action"],
        raw: true,
      }),
      models.AuditLog.findAll({
        attributes: ["method"],
        group: ["method"],
        raw: true,
      }),
    ]);

    const uniqueActions = actions.map((a: any) => a.action).sort();
    const uniqueMethods = methods.map((m: any) => m.method).sort();

    res.status(200).json({
      success: true,
      data: {
        actions: uniqueActions,
        methods: uniqueMethods,
        levels: ["info", "warning", "error", "critical"],
      },
    });
  } catch (error: any) {
    console.error("Error fetching audit log filters:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching filters",
      error: error.message,
    });
  }
};

export default {
  getAuditLogs,
  getAuditLogById,
  getUserAuditLogs,
  getAuditLogFilters,
};
