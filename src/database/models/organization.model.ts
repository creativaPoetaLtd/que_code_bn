import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  OrganizationCreationAttributes,
  OrganizationModelAttributes,
} from "../../types/model";

class Organization extends Model<
  OrganizationModelAttributes,
  OrganizationCreationAttributes
> {
  public id!: string;
  public name!: string;
  public type!: string;
  public email!: string;
  public ownerName!: string;
  public ownerPhone!: string;
  public ownerEmail!: string;
  public contactPhone!: string;
  public tinNumber!: string;
  public password!: string;
  public approvalStatus!: boolean;
  public categoryId?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const Organization_model = (sequelize: Sequelize) => {
  Organization.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true, allowNull: false },
      ownerName: { type: DataTypes.STRING, allowNull: false },
      ownerPhone: { type: DataTypes.STRING, allowNull: false },
      ownerEmail: { type: DataTypes.STRING, allowNull: false },
      contactPhone: { type: DataTypes.STRING, allowNull: false },
      tinNumber: { type: DataTypes.STRING, allowNull: false },
      
      password: { type: DataTypes.STRING, allowNull: false },
      approvalStatus: { type: DataTypes.BOOLEAN, defaultValue: false },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "OrganizationCategories",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "Organizations",
    }
  );

  return Organization;
};

export default Organization_model;
