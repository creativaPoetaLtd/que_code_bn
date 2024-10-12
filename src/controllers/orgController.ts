import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { OrganizationCreationAttributes, OrganizationModelAttributes } from "../types/model";
import cloudinary from "../helpers/cloudinary";
import multer from 'multer';

// Extend the Express Request type to include the file property
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
const create_org = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const existingOrganization = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { email: req.body.email } }
    );

    if (existingOrganization) {
      res.status(400).json({ message: "Organization already exists" });
      return;
    }

    const {
      name, type, email, ownerPhone, ownerEmail, contactPhone,
      tinNumber, registrationNumber, province, district, sector, cell
    } = req.body;
    
    let logo = '';
    let operationalDocument = '';

    // Check if both files are uploaded and assign URLs
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Upload logo if present
      if (files.logo && files.logo[0]) {
        const logoUpload = await cloudinary.uploader.upload(files.logo[0].path);
        logo = logoUpload.secure_url;
      }

      // Upload operationalDocument if present
      if (files.operationalDocument && files.operationalDocument[0]) {
        const operationalDocumentUpload = await cloudinary.uploader.upload(files.operationalDocument[0].path);
        operationalDocument = operationalDocumentUpload.secure_url;
      }
    }

    const organizationData: OrganizationCreationAttributes = {
      name, type, email, ownerPhone, ownerEmail, contactPhone,
      tinNumber, registrationNumber, province, district, sector, cell,
      logo, operationalDocument, apporvalStatus: false
    };

    const newOrganization = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "create",
      organizationData
    );

    res.status(201).json({
      message: "Organization registered successfully",
      organization: newOrganization,
    });
  } catch (error) {
    console.error("Error in registerOrganization:", error);
    res.status(500).json({
      message: "Error registering organization",
      error: (error as Error).message,
    });
  }
};

const get_all_orgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizations = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findAll"
    );

    res.status(200).json({ organizations });
  } catch (error) {
    console.error("Error in getOrganizations:", error);
    res.status(500).json({
      message: "Error fetching organizations",
      error: (error as Error).message,
    });
  }
}

const get_org_by_id = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!organization) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    res.status(200).json({ organization });
  } catch (error) {
    console.error("Error in getOrganizationById:", error);
    res.status(500).json({
      message: "Error fetching organization",
      error: (error as Error).message,
    });
  }
}

const update_org = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!organization) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const updatedOrganization = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      req.body,
      { where: { id: req.params.id } }
    );

    res.status(200).json({
      message: "Organization updated successfully",
      organization: updatedOrganization,
    });
  } catch (error) {
    console.error("Error in updateOrganization:", error);
    res.status(500).json({
      message: "Error updating organization",
      error: (error as Error).message,
    });
  }
}

const delete_org = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!organization) {
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

    console.error("Error in deleteOrganization:", error);
    res.status(500).json({
      message: "Error deleting organization",
      error: (error as Error).message,
    });
  }
}

const update_org_approval = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findOne",
      { where: { id: req.params.id } }
    );

    if (!organization) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const updatedOrganization = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      { approvalStatus: req.body.approvalStatus },
      { where: { id: req.params.id } }
    );

    res.status(200).json({
      message: "Organization approval status updated successfully",
      organization: updatedOrganization,
    });
  } catch (error) {
    console.error("Error in updateOrganizationApproval:", error);
    res.status(500).json({
      message: "Error updating organization approval status",
      error: (error as Error).message,
    });
  }
}

const get_approved_orgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizations = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findAll",
      { where: { approvalStatus: true } }
    );

    res.status(200).json({ organizations });
  } catch (error) {
    console.error("Error in getApprovedOrganizations:", error);
    res.status(500).json({
      message: "Error fetching approved organizations",
      error: (error as Error).message,
    });
  }
}

const get_unapproved_orgs = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizations = await read_function<OrganizationModelAttributes>(
      "Organization",
      "findAll",
      { where: { approvalStatus: false } }
    );

    res.status(200).json({ organizations });
  } catch (error) {
    console.error("Error in getUnapprovedOrganizations:", error);
    res.status(500).json({
      message: "Error fetching unapproved organizations",
      error: (error as Error).message,
    });
  }
}

export default {
  create_org,
  get_all_orgs,
  get_org_by_id,
  update_org,
  delete_org,
  update_org_approval,
  get_approved_orgs,
  get_unapproved_orgs
};

