import { DataTypes, Model, Sequelize, UUIDV4, CreationOptional } from "sequelize";
import { UserCreationAttributes, UserModelAttributes } from "../../types/model";

class User extends Model<UserModelAttributes, UserCreationAttributes> {
    public id!: CreationOptional<number>;
    public firstName!: string;
    public lastName!: string;
    public email!: string;
    public phone!: string;
    public password!: string;
    public gender!: string;
    public province!: string;
    public district!: string;
    public sector!: string;
    public cell!: string;
    public logo!: CreationOptional<string>;
    public national_id!: CreationOptional<string>;
    public approvalStatus!: boolean;
    public resetToken?: string;
    public resetTokenExpires?: Date;
    public otp?: string;
    public otpExpires?: Date;
    public lastOtpSent?: Date;
    public isVerified!: boolean;
}

const User_model = (sequelize: Sequelize) => {
    User.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        firstName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        province: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        district: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        sector: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        national_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        approvalStatus: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        resetToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        resetTokenExpires: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        otp: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        otpExpires: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        lastOtpSent: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        sequelize,
        tableName: "Users",
    });

    return User;
};

export default User_model;

