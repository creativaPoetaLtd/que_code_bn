import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import {
  ActionCreationAttributes,
  ActionModelAttributes,
  SubActionCreationAttributes,
  SubActionModelAttributes,
} from "../types/model";
import { Op } from "sequelize";
import cloudinary from "../helpers/cloudinary";

// Helper to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Step A: Type & Basic Information
const createActionStepA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const {
      type,
      name,
      slug,
      displayLayout,
      coverImage, // Can be URL if provided directly, or will be uploaded from file
      shortDescription,
      description,
      dedicatedQrCode,
    } = req.body;

    if (!type || !name) {
      res.status(400).json({
        message: "Type and name are required",
      });
      return;
    }

    const validTypes = [
      "ticket",
      "transport",
      "service",
      "subscription",
      "payment",
      "donation",
      "vote",
      "booking",
      "license",
      "membership",
      "rental",
      "group",
    ];

    if (!validTypes.includes(type)) {
      res.status(400).json({
        message: "Invalid action type",
        validTypes,
      });
      return;
    }

    const actionSlug = slug || generateSlug(name);

    // Check if slug already exists
    const existingAction = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { slug: actionSlug } }
    );

    if (existingAction) {
      res.status(400).json({
        message: "An action with this slug already exists",
        suggestedSlug: `${actionSlug}-${Date.now()}`,
      });
      return;
    }

    // Handle cover image upload to Cloudinary
    let coverImageUrl: string | null = coverImage || null;

    // Check for file in req.file (when using .single()) or req.files (when using .fields())
    const coverFile = (req as any).file || (req.files as { [fieldname: string]: Express.Multer.File[] })?.coverImage?.[0];
    
    if (coverFile) {
      try {

        // Upload cover image to Cloudinary
        let uploadResult: any;
        if ((coverFile as any).buffer && (coverFile as any).buffer.length > 0) {
          // Upload from buffer
          uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: 'actions/cover-images',
                transformation: [
                  { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
                  { quality: 'auto', format: 'auto' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end((coverFile as any).buffer);
          });
        } else if ((coverFile as any).path) {
          // Upload from file path
          uploadResult = await cloudinary.uploader.upload((coverFile as any).path, {
            folder: 'actions/cover-images',
            transformation: [
              { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', format: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }

        coverImageUrl = uploadResult.secure_url;
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    const actionData: ActionCreationAttributes = {
      organizationId,
      type,
      name,
      slug: actionSlug,
      displayLayout: displayLayout || "card",
      coverImage: coverImageUrl,
      shortDescription: shortDescription || null,
      description: description || null,
      currency: "RWF",
      pricing: { mode: "fixed", amount: 0 },
      availability: {},
      visibility: { mode: "public" },
      buyerFields: [],
      fulfillment: { storeOnBuyerQR: false },
      policy: {},
      webhooks: {},
      customFields: {},
      status: "draft",
      dedicatedQrCode: dedicatedQrCode || null,
    };

    const newAction = await insert_function<ActionModelAttributes>(
      "Action",
      "create",
      actionData
    );

    res.status(201).json({
      message: "Action created successfully (Step A)",
      data: newAction,
    });
  } catch (error: any) {
    console.error("Error in createActionStepA:", error);
    res.status(500).json({
      message: "An error occurred while creating the action",
      error: error.message,
    });
  }
};

// Step B: Pricing & Currency
const updateActionStepB = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { pricing, currency, taxProfileId } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (pricing) updateData.pricing = pricing;
    if (currency) updateData.currency = currency;
    if (taxProfileId !== undefined) updateData.taxProfileId = taxProfileId;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action pricing updated (Step B)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepB:", error);
    res.status(500).json({
      message: "An error occurred while updating pricing",
      error: error.message,
    });
  }
};

// Step C: Sub-actions
const createSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { name, description, price, stock, variants, metadata, sortOrder } =
      req.body;

    if (!name || price === undefined) {
      res.status(400).json({
        message: "Name and price are required",
      });
      return;
    }

    const subActionData: SubActionCreationAttributes = {
      actionId,
      name,
      description: description || null,
      price: parseFloat(price),
      stock: stock !== undefined ? parseInt(stock) : null,
      stockReserved: 0,
      variants: variants || {},
      metadata: metadata || {},
      isActive: true,
      sortOrder: sortOrder || 0,
    };

    const newSubAction = await insert_function<SubActionModelAttributes>(
      "SubAction",
      "create",
      subActionData
    );

    res.status(201).json({
      message: "Sub-action created successfully",
      data: newSubAction,
    });
  } catch (error: any) {
    console.error("Error in createSubAction:", error);
    res.status(500).json({
      message: "An error occurred while creating sub-action",
      error: error.message,
    });
  }
};

// Step D: Duration & Availability
const updateActionStepD = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { availability } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { availability: availability || {} },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action availability updated (Step D)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepD:", error);
    res.status(500).json({
      message: "An error occurred while updating availability",
      error: error.message,
    });
  }
};

// Step E: Visibility & Access
const updateActionStepE = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { visibility, buyerFields } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (visibility) updateData.visibility = visibility;
    if (buyerFields) updateData.buyerFields = buyerFields;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action visibility updated (Step E)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepE:", error);
    res.status(500).json({
      message: "An error occurred while updating visibility",
      error: error.message,
    });
  }
};

// Step F: Rules & Conditions
const updateActionStepF = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { policy } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { policy: policy || {} },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action policy updated (Step F)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepF:", error);
    res.status(500).json({
      message: "An error occurred while updating policy",
      error: error.message,
    });
  }
};

// Step G: Fulfillment & Delivery
const updateActionStepG = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { fulfillment } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { fulfillment: fulfillment || { storeOnBuyerQR: false } },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action fulfillment updated (Step G)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepG:", error);
    res.status(500).json({
      message: "An error occurred while updating fulfillment",
      error: error.message,
    });
  }
};

// Step H: Advanced Personalization
const updateActionStepH = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { customFields, webhooks } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = {};
    if (customFields) updateData.customFields = customFields;
    if (webhooks) updateData.webhooks = webhooks;

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action advanced settings updated (Step H)",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateActionStepH:", error);
    res.status(500).json({
      message: "An error occurred while updating advanced settings",
      error: error.message,
    });
  }
};

// Step I: Publish
const publishAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { status } = req.body; // "published" or "draft"

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const validStatus = ["draft", "published", "archived"];
    const newStatus = status || "published";

    if (!validStatus.includes(newStatus)) {
      res.status(400).json({
        message: "Invalid status",
        validStatus,
      });
      return;
    }

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { status: newStatus },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: `Action ${newStatus} successfully`,
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in publishAction:", error);
    res.status(500).json({
      message: "An error occurred while publishing action",
      error: error.message,
    });
  }
};

// Get all actions for an organization
const getOrganizationActions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { status, type } = req.query;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (type) where.type = type;

    const actions = await read_function<ActionModelAttributes>(
      "Action",
      "findAll",
      {
        where,
        order: [["createdAt", "DESC"]],
      }
    );

    res.status(200).json({
      message: "Actions retrieved successfully",
      data: actions,
    });
  } catch (error: any) {
    console.error("Error in getOrganizationActions:", error);
    res.status(500).json({
      message: "An error occurred while retrieving actions",
      error: error.message,
    });
  }
};

// Get single action by ID
const getActionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: { id: actionId },
      }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    res.status(200).json({
      message: "Action retrieved successfully",
      data: action,
    });
  } catch (error: any) {
    console.error("Error in getActionById:", error);
    res.status(500).json({
      message: "An error occurred while retrieving action",
      error: error.message,
    });
  }
};

// Get action by slug (public)
const getActionBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      {
        where: {
          slug,
          status: "published",
        },
      }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found or not published" });
      return;
    }

    res.status(200).json({
      message: "Action retrieved successfully",
      data: action,
    });
  } catch (error: any) {
    console.error("Error in getActionBySlug:", error);
    res.status(500).json({
      message: "An error occurred while retrieving action",
      error: error.message,
    });
  }
};

// Update action
const updateAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;
    const { coverImage, ...otherFields } = req.body;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    const updateData: any = { ...otherFields };

    // Handle cover image upload to Cloudinary if file is provided
    // Check for file in req.file (when using .single()) or req.files (when using .fields())
    const coverFile = (req as any).file || (req.files as { [fieldname: string]: Express.Multer.File[] })?.coverImage?.[0];
    
    if (coverFile) {
      try {
        // Delete old cover image from Cloudinary if it exists
        if (action.coverImage && action.coverImage.includes('cloudinary')) {
          try {
            // Extract publicId from Cloudinary URL
            // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{publicId}.{ext}
            const urlMatch = action.coverImage.match(/\/upload\/(.+)$/);
            if (urlMatch && urlMatch[1]) {
              // Remove file extension to get publicId
              const publicId = urlMatch[1].replace(/\.[^/.]+$/, '');
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (deleteError) {
            console.warn("Could not delete old cover image:", deleteError);
            // Continue with upload even if deletion fails
          }
        }

        // Upload new cover image to Cloudinary
        let uploadResult: any;
        if ((coverFile as any).buffer && (coverFile as any).buffer.length > 0) {
          uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: 'actions/cover-images',
                transformation: [
                  { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
                  { quality: 'auto', format: 'auto' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end((coverFile as any).buffer);
          });
        } else if ((coverFile as any).path) {
          uploadResult = await cloudinary.uploader.upload((coverFile as any).path, {
            folder: 'actions/cover-images',
            transformation: [
              { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', format: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }

        updateData.coverImage = uploadResult.secure_url;
      } catch (uploadError: any) {
        console.error("Error uploading cover image to Cloudinary:", uploadError);
        res.status(500).json({
          message: "Failed to upload cover image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    } else if (coverImage !== undefined && coverImage !== null && coverImage !== '') {
      // If coverImage is provided as a valid URL string (not file), use it directly
      // Only update if it's a non-empty string to preserve existing image when not changed
      updateData.coverImage = coverImage;
    }
    // If coverImage is undefined, null, or empty string, don't include it in updateData
    // This preserves the existing cover image in the database

    const updatedAction = await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      updateData,
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action updated successfully",
      data: updatedAction,
    });
  } catch (error: any) {
    console.error("Error in updateAction:", error);
    res.status(500).json({
      message: "An error occurred while updating action",
      error: error.message,
    });
  }
};

// Delete action
const deleteAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    const action = await read_function<ActionModelAttributes>(
      "Action",
      "findOne",
      { where: { id: actionId } }
    );

    if (!action) {
      res.status(404).json({ message: "Action not found" });
      return;
    }

    // Soft delete by archiving
    await insert_function<ActionModelAttributes>(
      "Action",
      "update",
      { status: "archived" },
      { where: { id: actionId } }
    );

    res.status(200).json({
      message: "Action archived successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteAction:", error);
    res.status(500).json({
      message: "An error occurred while deleting action",
      error: error.message,
    });
  }
};

// Get sub-actions for an action
const getSubActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actionId } = req.params;

    const subActions = await read_function<SubActionModelAttributes>(
      "SubAction",
      "findAll",
      {
        where: { actionId, isActive: true },
        order: [["sortOrder", "ASC"]],
      }
    );

    res.status(200).json({
      message: "Sub-actions retrieved successfully",
      data: subActions,
    });
  } catch (error: any) {
    console.error("Error in getSubActions:", error);
    res.status(500).json({
      message: "An error occurred while retrieving sub-actions",
      error: error.message,
    });
  }
};

// Update sub-action
const updateSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subActionId } = req.params;

    const updatedSubAction = await insert_function<SubActionModelAttributes>(
      "SubAction",
      "update",
      req.body,
      { where: { id: subActionId } }
    );

    res.status(200).json({
      message: "Sub-action updated successfully",
      data: updatedSubAction,
    });
  } catch (error: any) {
    console.error("Error in updateSubAction:", error);
    res.status(500).json({
      message: "An error occurred while updating sub-action",
      error: error.message,
    });
  }
};

// Delete sub-action
const deleteSubAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subActionId } = req.params;

    // Soft delete by deactivating
    await insert_function<SubActionModelAttributes>(
      "SubAction",
      "update",
      { isActive: false },
      { where: { id: subActionId } }
    );

    res.status(200).json({
      message: "Sub-action deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteSubAction:", error);
    res.status(500).json({
      message: "An error occurred while deleting sub-action",
      error: error.message,
    });
  }
};

export default {
  createActionStepA,
  updateActionStepB,
  createSubAction,
  updateActionStepD,
  updateActionStepE,
  updateActionStepF,
  updateActionStepG,
  updateActionStepH,
  publishAction,
  getOrganizationActions,
  getActionById,
  getActionBySlug,
  updateAction,
  deleteAction,
  getSubActions,
  updateSubAction,
  deleteSubAction,
};

