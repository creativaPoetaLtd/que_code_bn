"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
class User extends sequelize_1.Model {
}
const User_model = (sequelize) => {
    User.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        firstName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        lastName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        gender: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        phone: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        province: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        district: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        sector: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        // national_id: {
        //     type: DataTypes.STRING,
        //     allowNull: true,
        // },
        approvalStatus: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        resetToken: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        resetTokenExpires: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        otp: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        otpExpires: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        lastOtpSent: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        isVerified: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        sequelize,
        tableName: "Users",
    });
    return User;
};
exports.default = User_model;
