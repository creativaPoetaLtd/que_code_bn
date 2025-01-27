"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_methods_1 = require("../utils/db_methods");
const cloudinary_1 = __importDefault(require("../helpers/cloudinary"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const create_org = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const existingOrganization = yield (0, db_methods_1.read_function)("Organization", "findOne", { where: { email: req.body.email } });
        if (existingOrganization) {
            res.status(400).json({ message: "Organization already exists" });
            return;
        }
        const { name, type, email, ownerPhone, ownerEmail, contactPhone, password, tinNumber, registrationNumber, province, district, sector, cell } = req.body;
        const saltRounds = 10;
        const hashedPassword = yield bcrypt_1.default.hash(password, saltRounds);
        let logo = '';
        let operationalDocument = '';
        if (req.files) {
            const files = req.files;
            if (files.logo && files.logo[0]) {
                const logoUpload = yield cloudinary_1.default.uploader.upload(files.logo[0].path);
                logo = logoUpload.secure_url;
            }
            if (files.operationalDocument && files.operationalDocument[0]) {
                const operationalDocumentUpload = yield cloudinary_1.default.uploader.upload(files.operationalDocument[0].path);
                operationalDocument = operationalDocumentUpload.secure_url;
            }
        }
        const organizationData = {
            name, type, email, ownerPhone, ownerEmail, contactPhone,
            tinNumber, registrationNumber, password: hashedPassword, province, district, sector, cell,
            logo, operationalDocument, approvalStatus: false
        };
        const newOrganization = yield (0, db_methods_1.insert_function)("Organization", "create", organizationData);
        res.status(201).json({
            message: "Organization registered successfully",
            organization: newOrganization,
        });
    }
    catch (error) {
        console.error("Error in registerOrganization:", error);
        res.status(500).json({
            message: "Error registering organization",
            error: error.message,
        });
    }
});
const get_all_orgs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organizations = yield (0, db_methods_1.read_function)("Organization", "findAll");
        res.status(200).json({ organizations });
    }
    catch (error) {
        console.error("Error in getOrganizations:", error);
        res.status(500).json({
            message: "Error fetching organizations",
            error: error.message,
        });
    }
});
const get_org_by_id = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organization = yield (0, db_methods_1.read_function)("Organization", "findOne", { where: { id: req.params.id } });
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }
        res.status(200).json({ organization });
    }
    catch (error) {
        console.error("Error in getOrganizationById:", error);
        res.status(500).json({
            message: "Error fetching organization",
            error: error.message,
        });
    }
});
const update_org = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organization = yield (0, db_methods_1.read_function)("Organization", "findOne", { where: { id: req.params.id } });
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }
        let logo = organization.logo;
        let operationalDocument = organization.operationalDocument;
        if (req.files) {
            const files = req.files;
            if (files.logo && files.logo[0]) {
                const logoUpload = yield cloudinary_1.default.uploader.upload(files.logo[0].path);
                logo = logoUpload.secure_url;
            }
            if (files.operationalDocument && files.operationalDocument[0]) {
                const operationalDocumentUpload = yield cloudinary_1.default.uploader.upload(files.operationalDocument[0].path);
                operationalDocument = operationalDocumentUpload.secure_url;
            }
        }
        const updatedData = {
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
        const updatedOrganization = yield (0, db_methods_1.insert_function)("Organization", "update", updatedData, { where: { id: req.params.id } });
        res.status(200).json({
            message: "Organization updated successfully",
            organization: organization,
        });
    }
    catch (error) {
        console.error("Error in updateOrganization:", error);
        res.status(500).json({
            message: "Error updating organization",
            error: error.message,
        });
    }
});
const delete_org = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organization = yield (0, db_methods_1.read_function)("Organization", "findOne", { where: { id: req.params.id } });
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }
        yield (0, db_methods_1.read_function)("Organization", "destroy", { where: { id: req.params.id } });
        res.status(200).json({ message: "Organization deleted successfully" });
    }
    catch (error) {
        console.error("Error in deleteOrganization:", error);
        res.status(500).json({
            message: "Error deleting organization",
            error: error.message,
        });
    }
});
const update_org_approval = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organization = yield (0, db_methods_1.read_function)("Organization", "findOne", { where: { id: req.params.id } });
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }
        const newApprovalStatus = !organization.approvalStatus;
        const updatedData = {
            approvalStatus: newApprovalStatus,
        };
        const updatedOrganization = yield (0, db_methods_1.insert_function)("Organization", "update", updatedData, { where: { id: req.params.id } });
        console.log("updatedOrganization", updatedOrganization);
        res.status(200).json({
            message: "Organization approval status updated successfully",
            organization: organization,
        });
    }
    catch (error) {
        console.error("Error in updateOrganizationApproval:", error);
        res.status(500).json({
            message: "Error updating organization approval status",
            error: error.message,
        });
    }
});
const get_approved_orgs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organizations = yield (0, db_methods_1.read_function)("Organization", "findAll", { where: { approvalStatus: true } });
        res.status(200).json({ organizations });
    }
    catch (error) {
        console.error("Error in getApprovedOrganizations:", error);
        res.status(500).json({
            message: "Error fetching approved organizations",
            error: error.message,
        });
    }
});
const get_unapproved_orgs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organizations = yield (0, db_methods_1.read_function)("Organization", "findAll", { where: { approvalStatus: false } });
        res.status(200).json({ organizations });
    }
    catch (error) {
        console.error("Error in getUnapprovedOrganizations:", error);
        res.status(500).json({
            message: "Error fetching unapproved organizations",
            error: error.message,
        });
    }
});
exports.default = {
    create_org,
    get_all_orgs,
    get_org_by_id,
    update_org,
    delete_org,
    update_org_approval,
    get_approved_orgs,
    get_unapproved_orgs
};
