import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  OrganizationCreationAttributes,
  OrganizationModelAttributes,
  WalletCreationAttributes,
  ProfileCreationAttributes,
  ProfileModelAttributes,
} from "../types/model";
import bcrypt from "bcrypt";
import sendEmail from "../helpers/email";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import cloudinary from "../helpers/cloudinary";
import fs from "fs";

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const create_organization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Check for multer errors
    if ((req as any).fileValidationError) {
      res.status(400).json({
        message: "File validation error",
        error: (req as any).fileValidationError
      });
      return;
    }
    // Handle multipart form data
    const {
      name,
      type,
      email,
      ownerName,
      ownerPhone,
      ownerEmail,
      contactPhone,
      tinNumber,
      
      password,
      categoryId,
    } = req.body;

    // Note: File uploads (logo, operationalDocument) are no longer handled in organization creation

    // Map the type field to categoryId since frontend sends category ID as type
    const actualCategoryId = type || categoryId;

    // Validate required fields
    if (
      !name ||
      !email ||
      !ownerName ||
      !ownerPhone ||
      !ownerEmail ||
      !contactPhone ||
      !tinNumber ||
      !password
    ) {
      res.status(400).json({
        message: "Missing required fields",
        required: [
          "name",
          "email",
          "ownerName",
          "ownerPhone",
          "ownerEmail",
          "contactPhone",
          "tinNumber",
          "password",
        ],
      });
      return;
    }

    // Validate categoryId if provided
    if (actualCategoryId) {
      try {
        console.log(`Validating category with ID: ${actualCategoryId}`);
        const category = await read_function<any>(
          "Category",
          "findOne",
          { where: { id: actualCategoryId } }
        );

        console.log(`Category lookup result:`, category ? "Found" : "Not found");
        
        if (!category) {
          // Try to find all categories to help with debugging
          const allCategories = await read_function<any[]>(
            "Category",
            "findAll",
            { attributes: ["id", "name", "isActive"] }
          );
          
          console.log(`Available categories:`, allCategories);
          
          res.status(400).json({ 
            message: "Invalid organization category",
            providedCategoryId: actualCategoryId,
            availableCategories: Array.isArray(allCategories) 
              ? allCategories.map((c: any) => {
                  const plain = isSequelizeInstance(c) ? c.get({ plain: true }) : c;
                  return { id: plain.id, name: plain.name, isActive: plain.isActive };
                })
              : "Unable to fetch categories",
            hint: "Make sure the category ID exists and is active"
          });
          return;
        }

        // Check if category is active
        const plainCategory = isSequelizeInstance(category)
          ? category.get({ plain: true })
          : category;
        
        if (plainCategory.isActive === false) {
          res.status(400).json({ 
            message: "Organization category is not active",
            providedCategoryId: actualCategoryId,
            categoryName: plainCategory.name,
            hint: "Please select an active category"
          });
          return;
        }

        console.log(`Category validated successfully: ${plainCategory.name} (ID: ${plainCategory.id})`);
      } catch (error: any) {
        console.error('Category validation error:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        res.status(400).json({ 
          message: "Error validating category ID",
          providedCategoryId: actualCategoryId,
          error: error.message || "Category ID validation failed",
          hint: "Please check the category ID format and ensure it exists in the database"
        });
        return;
      }
    } else {
      res.status(400).json({ 
        message: "Organization category is required",
        availableCategories: "Use one of the valid category IDs from /api/organization-categories/"
      });
      return;
    }


    // Check if organization already exists
    const existingOrg = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { email: email.toLowerCase() } }
    );

    if (existingOrg) {
      res.status(400).json({ message: "Organization already exists" });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Note: File uploads are no longer handled in organization creation

    // Create organization
    const orgData: OrganizationCreationAttributes = {
      name,
      email: email.toLowerCase(),
      ownerName,
      ownerPhone,
      ownerEmail,
      contactPhone,
      tinNumber,
      password: hashedPassword,
      categoryId: actualCategoryId || undefined,
    };

    let newOrg: any;
    try {
      newOrg = await insert_function<OrganizationModelAttributes>(
        "Organization",
        "create",
        orgData
      );
    } catch (dbError: any) {
      console.error("Error creating organization in database:", dbError);
      // Check for specific database errors
      if (dbError.name === "SequelizeUniqueConstraintError") {
        res.status(400).json({
          message: "Organization with this email already exists",
          field: dbError.errors?.[0]?.path || "email",
        });
        return;
      }
      if (dbError.name === "SequelizeForeignKeyConstraintError") {
        res.status(400).json({
          message: "Invalid organization category",
          error: "The provided category does not exist",
        });
        return;
      }
      if (dbError.name === "SequelizeValidationError") {
        res.status(400).json({
          message: "Validation error",
          errors: dbError.errors?.map((e: any) => ({
            field: e.path,
            message: e.message,
          })),
        });
        return;
      }
      throw dbError; // Re-throw to be caught by outer catch
    }

    // Extract organization ID (handle both Sequelize instances and plain objects)
    const orgId = isSequelizeInstance(newOrg)
      ? newOrg.get("id")
      : newOrg.id;

    // Generate QR Code for organization profile
    let qrCodeData: string;
    try {
      const orgProfileLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/welcome/${orgId}`;
      qrCodeData = await QRCode.toDataURL(orgProfileLink);
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
      // If QR code generation fails, we should still create the profile with a placeholder
      // or rollback the organization creation
      // For now, let's use a placeholder
      qrCodeData = `placeholder-qr-${orgId}`;
    }

    // Create profile for the new organization
    try {
      const profileData: ProfileCreationAttributes = {
        type: "organization",
        organizationId: orgId,
        qrCode: qrCodeData,
      };

      await insert_function<ProfileModelAttributes>(
        "Profile",
        "create",
        profileData
      );
    } catch (profileError: any) {
      console.error("Error creating profile for organization:", profileError);
      // If profile creation fails, we should rollback organization creation
      // For now, log the error and continue (organization is already created)
      // In production, you might want to delete the organization here
      if (profileError.name === "SequelizeUniqueConstraintError") {
        // QR code collision (unlikely but possible)
        console.error("QR code collision detected, attempting to regenerate...");
        try {
          const orgProfileLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/welcome/${orgId}?t=${Date.now()}`;
          const newQrCodeData = await QRCode.toDataURL(orgProfileLink);
          await insert_function<ProfileModelAttributes>(
            "Profile",
            "create",
            {
              type: "organization",
              organizationId: orgId,
              qrCode: newQrCodeData,
            }
          );
        } catch (retryError) {
          console.error("Failed to create profile after retry:", retryError);
          throw new Error("Failed to create organization profile");
        }
      } else {
        throw profileError;
      }
    }

    // Create wallet for the new organization
    try {
      const walletData: WalletCreationAttributes = {
        organizationId: orgId,
      };

      await insert_function("Wallet", "create", walletData);
    } catch (walletError) {
      console.error("Error creating wallet for organization:", walletError);
      // Wallet creation failure shouldn't fail the entire registration
      // but we should log it
    }

    // Extract email from organization (handle both Sequelize instances and plain objects)
    const orgEmail = isSequelizeInstance(newOrg)
      ? newOrg.get("email")
      : newOrg.email;

    // Generate verification token (valid for 2 days)
    const verificationToken = jwt.sign(
      { email: orgEmail, id: orgId, type: "organization" },
      JWT_SECRET,
      { expiresIn: "2d", algorithm: "HS256" }
    );

    // Verification URL
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/verify?token=${verificationToken}`;

    // Send verification email to organization's email
    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: "Verify Your Organization Registration",
        type: "notification",
        data: {
          title: `Welcome ${name}!`,
          body: `Thank you for registering your organization "${name}". Please click the link below to verify your email address and activate your organization account: <br><br><a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a><br><br>This verification link will expire in 2 days.`,
        },
      });

      console.log(
        `Verification email sent successfully to organization: ${email}`
      );
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail the registration if email fails, but log the error
    }

    const plainOrg = isSequelizeInstance(newOrg)
      ? newOrg.get({ plain: true })
      : newOrg;
    const { password: _, ...orgWithoutPassword } = plainOrg;

    res.status(201).json({
      message:
        "Organization registered successfully. Please check your email for verification instructions.",
      data: orgWithoutPassword,
    });
  } catch (error: any) {
    console.error("Organization registration error:", error);
    console.error("Error stack:", error.stack);
    
    // Provide more detailed error information
    const errorMessage = error.message || "Unknown error";
    const isDevelopment = process.env.NODE_ENV !== "production";
    
    res.status(500).json({
      message: "An error occurred while registering the organization",
      ...(isDevelopment && {
        error: errorMessage,
        details: error.errors || error.details,
        stack: error.stack,
      }),
    });
  }
};

const get_all_organizations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const allOrgs = await read_function<OrganizationModelAttributes[]>(
      "Organization",
      "findAll",
      {
        include: [
          {
            model: database_models.Category,
            as: "category",
            attributes: ["id", "name", "description", "createdAt", "updatedAt"],
          },
        ],
      }
    );
    const plainOrgs = Array.isArray(allOrgs)
      ? allOrgs.map((o) =>
          isSequelizeInstance(o) ? o.get({ plain: true }) : o
        )
      : [];
    res.status(200).json(plainOrgs);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching all organizations" });
  }
};

const get_organization_by_id = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      {
        where: { id: req.params.id },
        include: [
          {
            model: database_models.Category,
            as: "category",
            attributes: ["id", "name", "description", "createdAt", "updatedAt"],
          },
        ],
      }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const plainOrg = isSequelizeInstance(org) ? org.get({ plain: true }) : org;
    res.status(200).json(plainOrg);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the organization" });
  }
};

const update_organization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const updateData: Partial<OrganizationModelAttributes> = {
      ...req.body,
    };


    // Hash password if provided
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    const updatedOrg = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      updateData,
      { where: { id: req.params.id } }
    );

    const plainOrg = isSequelizeInstance(updatedOrg)
      ? updatedOrg.get({ plain: true })
      : updatedOrg;
    res.status(200).json(plainOrg);
  } catch (error) {
    console.error("Error in update_organization:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the organization" });
  }
};

const delete_organization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    await read_function<OrganizationModelAttributes>(
      "Organization",
      "destroy",
      { where: { id: req.params.id } }
    );

    res.status(200).json({ message: "Organization deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while deleting the organization" });
  }
};

const approve_organization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const approvedOrg = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      { approvalStatus: true },
      { where: { id: req.params.id } }
    );

    const plainOrg = isSequelizeInstance(approvedOrg)
      ? approvedOrg.get({ plain: true })
      : approvedOrg;
    res.status(200).json(plainOrg);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while approving the organization" });
  }
};

const disapprove_organization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const disapprovedOrg = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      { approvalStatus: false },
      { where: { id: req.params.id } }
    );

    const plainOrg = isSequelizeInstance(disapprovedOrg)
      ? disapprovedOrg.get({ plain: true })
      : disapprovedOrg;
    res.status(200).json(plainOrg);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while disapproving the organization",
    });
  }
};

const get_approved_organizations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const approvedOrgs = await read_function<OrganizationModelAttributes[]>(
      "Organization",
      "findAll",
      { where: { approvalStatus: true } }
    );
    const plainOrgs = Array.isArray(approvedOrgs)
      ? approvedOrgs.map((o) =>
          isSequelizeInstance(o) ? o.get({ plain: true }) : o
        )
      : [];
    res.status(200).json(plainOrgs);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching all approved organizations",
    });
  }
};

const get_unapproved_organizations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const unapprovedOrgs = await read_function<OrganizationModelAttributes[]>(
      "Organization",
      "findAll",
      { where: { approvalStatus: false } }
    );
    const plainOrgs = Array.isArray(unapprovedOrgs)
      ? unapprovedOrgs.map((o) =>
          isSequelizeInstance(o) ? o.get({ plain: true }) : o
        )
      : [];
    res.status(200).json(plainOrgs);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching all unapproved organizations",
    });
  }
};

// Email verification via token for organizations
const verify_organization_email_token = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      res.status(400).json({ message: "Verification token is required" });
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET) as any;
    } catch (err) {
      res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
      return;
    }

    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      {
        where: { email: payload.email.toLowerCase() },
      }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    res.status(200).json({
      message: "Organization email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Organization email verification error:", error);
    res
      .status(500)
      .json({ message: "An error occurred during email verification" });
  }
};

const get_organization_category = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const org = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      {
        where: { id: req.params.id },
        include: [
          {
            model: database_models.Category,
            as: "category",
            attributes: ["id", "name", "description", "createdAt", "updatedAt"],
          },
        ],
      }
    );

    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const plainOrg = isSequelizeInstance(org) ? org.get({ plain: true }) : org;
    
    if (!plainOrg.category) {
      res.status(404).json({ message: "Organization has no category assigned" });
      return;
    }

    res.status(200).json(plainOrg.category);
  } catch (error) {
    console.error("Error fetching organization category:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the organization category" });
  }
};

export default {
  create_organization,
  get_all_organizations,
  get_organization_by_id,
  update_organization,
  delete_organization,
  approve_organization,
  disapprove_organization,
  get_approved_organizations,
  get_unapproved_organizations,
  verify_organization_email_token,
  get_organization_category,
};
