"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
class Organization extends sequelize_1.Model {
}
const organization_model = (sequelize) => {
    Organization.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        type: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        ownerPhone: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        ownerEmail: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        contactPhone: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        tinNumber: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        registrationNumber: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        province: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        district: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        sector: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        cell: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        logo: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        operationalDocument: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        approvalStatus: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        sequelize,
        tableName: "organizations2",
    });
    return Organization;
};
exports.default = organization_model;
