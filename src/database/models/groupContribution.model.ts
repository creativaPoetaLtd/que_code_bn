import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  GroupContributionAttributes,
  GroupContributionCreationAttributes,
} from "../../types/model";

class GroupContribution extends Model<
  GroupContributionAttributes,
  GroupContributionCreationAttributes
> {
  public id!: string;
  public groupId!: string;
  public createdBy!: string;
  public title!: string;
  public note!: string | null;
  public goalAmount!: number;
  public type!: "fixed" | "flexible";
  public amountPerMember!: number | null;
  public minimumAmount!: number | null;
  public deadline!: Date | null;
  public status!: "active" | "completed" | "closed" | "expired";
  public visibilityMode!: "all" | "admin_only";
  public currency!: string;
  public collectedAmount!: number;
  public contributorCount!: number;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const groupContribution_model = (sequelize: Sequelize) => {
  GroupContribution.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      groupId: { type: DataTypes.UUID, allowNull: false },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      goalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      type: {
        type: DataTypes.ENUM("fixed", "flexible"),
        allowNull: false,
      },
      amountPerMember: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      minimumAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      deadline: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "completed", "closed", "expired"),
        defaultValue: "active",
      },
      visibilityMode: {
        type: DataTypes.ENUM("all", "admin_only"),
        defaultValue: "all",
      },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      collectedAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      contributorCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    { sequelize, tableName: "GroupContributions" }
  );

  return GroupContribution;
};

export default groupContribution_model;
