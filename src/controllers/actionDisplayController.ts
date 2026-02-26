import { Request, Response } from "express";
import { read_function } from "../utils/db_methods";
import {
  ActionModelAttributes,
  SubActionModelAttributes,
} from "../types/model";
import { Op } from "sequelize";


const getPublicActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    const actions = await read_function<ActionModelAttributes>(
      "Action",
      "findAll",
      {
        where: {
          organizationId,
          status: "published",
          visibility: {
            mode: "public",
          },
        },
        order: [["createdAt", "DESC"]],
      }
    );

    res.status(200).json({
      success: true,
      message: "Public actions retrieved successfully",
      data: actions,
    });
  } catch (error: any) {
    console.error("Error in getPublicActions:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving public actions",
      error: error.message,
    });
  }
};

// Get public action by slug with sub-actions
const getPublicActionBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: {
          slug,
          status: "published",
          visibility: {
            mode: "public",
          },
        },
      }
    );

    if (!action) {
      res.status(404).json({
        success: false,
        message: "Action not found or not available",
      });
      return;
    }

    // Get sub-actions if any
    const subActions = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findAll",
      {
        where: {
          actionId: action.id,
          isActive: true,
        },
        order: [["sortOrder", "ASC"]],
      }
    );

    res.status(200).json({
      success: true,
      message: "Action retrieved successfully",
      data: {
        ...action,
        subActions,
      },
    });
  } catch (error: any) {
    console.error("Error in getPublicActionBySlug:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving action",
      error: error.message,
    });
  }
};

// Get all published actions (for discovery/search)
const getAllPublishedActions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type, organizationId, limit = 50, offset = 0 } = req.query;

    const where: any = {
      status: "published",
      visibility: {
        mode: "public",
      },
    };

    if (type) where.type = type;
    if (organizationId) where.organizationId = organizationId;

    const actions = await read_function<ActionModelAttributes>(
      "Action",
      "findAll",
      {
        where,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order: [["createdAt", "DESC"]],
      }
    );

    res.status(200).json({
      success: true,
      message: "Published actions retrieved successfully",
      data: actions,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    console.error("Error in getAllPublishedActions:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving actions",
      error: error.message,
    });
  }
};

export default {
  getPublicActions,
  getPublicActionBySlug,
  getAllPublishedActions,
};

