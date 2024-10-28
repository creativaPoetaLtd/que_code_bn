import { DataTypes, Model, Sequelize, UUIDV4, CreationOptional } from "sequelize";
import { OrganizationCreationAttributes, OrganizationModelAttributes } from "../../types/model";

class Organization extends Model<OrganizationModelAttributes, OrganizationCreationAttributes> {
    public id!: CreationOptional<number>;
    public name!: string;
    public type!: string;
    public email!: string;
    public ownerPhone!: string;
    public ownerEmail!: string;
    public password!: string;
    public contactPhone!: string;
    public tinNumber!: string;
    public registrationNumber!: string;
    public province!: string;
    public district!: string;
    public sector!: string;
    public cell!: string;
    public logo!: CreationOptional<string>;
    public operationalDocument!: CreationOptional<string>;
}

const organization_model = (sequelize: Sequelize) => {
    Organization.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ownerPhone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ownerEmail: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        contactPhone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tinNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        registrationNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        province: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        district: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        sector: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        cell: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        logo: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        operationalDocument: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        apporvalStatus: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        sequelize,
        tableName: "organizations2",
    });

    return Organization;
};

export default organization_model;

