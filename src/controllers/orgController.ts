import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { OrganizationCreationAttributes, OrganizationModelAttributes } from "../types/model";
import cloudinary from "../helpers/cloudinary";
import bcrypt from 'bcrypt';

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
      name, type, email, ownerPhone, ownerEmail, contactPhone, password,
      tinNumber, registrationNumber, province, district, sector, cell
    } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    
    let logo = '';
    let operationalDocument = '';

    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (files.logo && files.logo[0]) {
        const logoUpload = await cloudinary.uploader.upload(files.logo[0].path);
        logo = logoUpload.secure_url;
      }

      if (files.operationalDocument && files.operationalDocument[0]) {
        const operationalDocumentUpload = await cloudinary.uploader.upload(files.operationalDocument[0].path);
        operationalDocument = operationalDocumentUpload.secure_url;
      }
    }

    const organizationData: OrganizationCreationAttributes = {
      name, type, email, ownerPhone, ownerEmail, contactPhone,
      tinNumber, registrationNumber, password:hashedPassword, province, district, sector, cell,
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

    let logo = organization.logo;
    let operationalDocument = organization.operationalDocument;

    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (files.logo && files.logo[0]) {
        const logoUpload = await cloudinary.uploader.upload(files.logo[0].path);
        logo = logoUpload.secure_url;
      }

      if (files.operationalDocument && files.operationalDocument[0]) {
        const operationalDocumentUpload = await cloudinary.uploader.upload(files.operationalDocument[0].path);
        operationalDocument = operationalDocumentUpload.secure_url;
      }
    }

    const updatedData: Partial<OrganizationCreationAttributes> = {
      name: req.body.name || organization.name,
      type: req.body.type || organization.type,
      email: req.body.email || organization.email,
      ownerPhone: req.body.ownerPhone || organization.ownerPhone,
      ownerEmail: req.body.ownerEmail || organization.ownerEmail,
      contactPhone: req.body.contactPhone || organization.contactPhone,
      tinNumber: req.body.tinNumber || organization.tinNumber,
      registrationNumber: req.body.registrationNumber || organization.registrationNumber,
      province: req.body.province || organization.province,
      district: req.body.district || organization.district,
      sector: req.body.sector || organization.sector,
      cell: req.body.cell || organization.cell,
      logo: logo,
      operationalDocument: operationalDocument,
    };

    const updatedOrganization = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      updatedData,
      { where: { id: req.params.id } }
    );

    res.status(200).json({
      message: "Organization updated successfully",
      organization: organization,
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

    const newApprovalStatus = !organization.apporvalStatus;
    const updatedData: Partial<OrganizationCreationAttributes> = {
			apporvalStatus: newApprovalStatus,
		};

    const updatedOrganization = await insert_function<OrganizationModelAttributes>(
      "Organization",
      "update",
      updatedData,
      { where: { id: req.params.id } }
    );
console.log("updatedOrganization", updatedOrganization);

    res.status(200).json({
      message: "Organization approval status updated successfully",
      organization: organization,
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

