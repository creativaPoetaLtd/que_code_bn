import { Request, Response } from "express";
import { read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ActionModelAttributes,
  SubActionModelAttributes,
} from "../types/model";
import { Op } from "sequelize";

function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

const toPlainObject = (value: any) =>
  isSequelizeInstance(value) ? value.get({ plain: true }) : value;

const normalizeAmount = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getFallbackPriceFromAction = (action: any): number => {
  const pricing = action?.pricing || {};
  if (typeof pricing.amount !== "undefined") {
    return normalizeAmount(pricing.amount);
  }
  if (typeof pricing.min !== "undefined") {
    return normalizeAmount(pricing.min);
  }
  return 0;
};

const enrichActionsWithMinPrice = async (actions: any[]) => {
  if (!actions.length) {
    return actions;
  }

  const actionIds = actions.map((action) => action.id);

  const subActions = await database_models.SubAction.findAll({
    where: {
      actionId: {
        [Op.in]: actionIds,
      },
      isActive: true,
    },
    attributes: ["actionId", "price"],
  });

  const minPriceByActionId = new Map<string, number>();

  for (const subActionRow of subActions) {
    const subAction = toPlainObject(subActionRow);
    const price = normalizeAmount(subAction.price);
    const currentMin = minPriceByActionId.get(subAction.actionId);
    if (currentMin === undefined || price < currentMin) {
      minPriceByActionId.set(subAction.actionId, price);
    }
  }

  return actions.map((action) => {
    const minPrice =
      minPriceByActionId.get(action.id) ?? getFallbackPriceFromAction(action);

    return {
      ...action,
      minPrice: minPrice.toFixed(2),
      currency: action.currency,
    };
  });
};


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

    const plainActions = Array.isArray(actions)
      ? actions.map((action) => toPlainObject(action))
      : [];

    const actionsWithMinPrice = await enrichActionsWithMinPrice(plainActions);

    res.status(200).json({
      success: true,
      message: "Public actions retrieved successfully",
      data: actionsWithMinPrice,
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

    const plainAction = toPlainObject(action);
    const plainSubActions = Array.isArray(subActions)
      ? subActions.map((subAction) => toPlainObject(subAction))
      : [];

    const minActiveSubActionPrice = plainSubActions.length
      ? Math.min(...plainSubActions.map((subAction) => normalizeAmount(subAction.price)))
      : getFallbackPriceFromAction(plainAction);

    res.status(200).json({
      success: true,
      message: "Action retrieved successfully",
      data: {
        ...plainAction,
        minPrice: minActiveSubActionPrice.toFixed(2),
        currency: plainAction.currency,
        subActions: plainSubActions,
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

    const plainActions = Array.isArray(actions)
      ? actions.map((action) => toPlainObject(action))
      : [];

    const actionsWithMinPrice = await enrichActionsWithMinPrice(plainActions);

    res.status(200).json({
      success: true,
      message: "Published actions retrieved successfully",
      data: actionsWithMinPrice,
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

