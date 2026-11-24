import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  OrganizationCreationAttributes,
  OrganizationModelAttributes,
} from "../../types/model";
import {
  DEFAULT_ORGANIZATION_TIER,
  ORGANIZATION_TIERS,
  OrganizationTier,
} from "../../utils/accountTiers";

class Organization extends Model<
  OrganizationModelAttributes,
  OrganizationCreationAttributes
> {
  public id!: string;
  public name!: string;
  public email!: string;
  public ownerName!: string;
  public ownerPhone!: string;
  public ownerEmail!: string;
  public contactPhone!: string;
  public tinNumber!: string;
  public password!: string;
  public status!: "pending" | "active" | "inactive" | "suspended";
  public categoryId?: string;
  public accountTier!: OrganizationTier;
  public npoRequestedAt?: Date | null; // pending request to become an NPO
  public npoRequestNote?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const Organization_model = (sequelize: Sequelize) => {
  Organization.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true, allowNull: false },
      ownerName: { type: DataTypes.STRING, allowNull: false },
      ownerPhone: { type: DataTypes.STRING, allowNull: false },
      ownerEmail: { type: DataTypes.STRING, allowNull: false },
      contactPhone: { type: DataTypes.STRING, allowNull: false },
      tinNumber: { type: DataTypes.STRING, allowNull: false },

      password: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "active", "inactive", "suspended"),
        allowNull: false,
        defaultValue: "pending",
      },
      accountTier: {
        type: DataTypes.ENUM(...ORGANIZATION_TIERS),
        allowNull: false,
        defaultValue: DEFAULT_ORGANIZATION_TIER,
      },
      npoRequestedAt: { type: DataTypes.DATE, allowNull: true },
      npoRequestNote: { type: DataTypes.TEXT, allowNull: true },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Categories",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "Organizations",
    },
  );

  return Organization;
};

export default Organization_model;
