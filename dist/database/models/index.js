"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const organization_model_1 = __importDefault(require("./organization.model"));
const user_model_1 = __importDefault(require("./user.model"));
const Models = (sequelize) => {
    const OrganizationModel = (0, organization_model_1.default)(sequelize);
    const UserModel = (0, user_model_1.default)(sequelize);
    return {
        Organization: OrganizationModel,
        User: UserModel,
    };
};
exports.default = Models;
