import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  PublicContributionAttributes,
  PublicContributionCreationAttributes,
} from "../../types/model";

class PublicContribution extends Model<
  PublicContributionAttributes,
  PublicContributionCreationAttributes
> {
  public id!: string;
  public createdBy!: string;
  public walletId!: string | null;
  public title!: string;
  public note!: string | null;
  public goalAmount!: number | null;
  public type!: "fixed" | "flexible";
  public amountPerMember!: number | null;
  public minimumAmount!: number | null;
  public deadline!: Date | null;
  public disbursementPolicy!: "hold" | "auto";
  public status!: "active" | "completed" | "closed" | "expired";
  public visibilityMode!: "all" | "creator_only";
  public currency!: string;
  public collectedAmount!: number;
  public contributorCount!: number;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const publicContribution_model = (sequelize: Sequelize) => {
  PublicContribution.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      walletId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      goalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      type: {
        type: DataTypes.ENUM("fixed", "flexible"),
        allowNull: false,
      },
      amountPerMember: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      minimumAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      deadline: { type: DataTypes.DATE, allowNull: true },
      disbursementPolicy: {
        type: DataTypes.ENUM("hold", "auto"),
        allowNull: false,
        defaultValue: "hold",
      },
      status: {
        type: DataTypes.ENUM("active", "completed", "closed", "expired"),
        defaultValue: "active",
      },
      visibilityMode: {
        type: DataTypes.ENUM("all", "creator_only"),
        defaultValue: "all",
      },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      collectedAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      contributorCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    { sequelize, tableName: "PublicContributions" }
  );

  return PublicContribution;
};

export default publicContribution_model;
