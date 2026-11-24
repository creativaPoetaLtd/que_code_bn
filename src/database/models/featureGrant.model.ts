// featureGrant.model.ts
// Admin-granted access to a feature the account's tier doesn't include by default
// (the "On demand" cells of the account types spec), or a custom daily transfer limit
// when feature = "dailyTransferLimit".
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { FeatureGrantAttributes, FeatureGrantCreationAttributes } from "../../types/model";

class FeatureGrant extends Model<FeatureGrantAttributes, FeatureGrantCreationAttributes> {
  public id!: string;
  public userId?: string | null;
  public organizationId?: string | null;
  public feature!: string;
  public fee?: number | null;
  public limitAmount?: number | null;
  public isActive!: boolean;
  public expiresAt?: Date | null;
  public note?: string | null;
  public grantedByUserId?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const featureGrant_model = (sequelize: Sequelize) => {
  FeatureGrant.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      feature: { type: DataTypes.STRING, allowNull: false },
      fee: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      limitAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      note: { type: DataTypes.STRING, allowNull: true },
      grantedByUserId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "FeatureGrants" }
  );

  return FeatureGrant;
};

export default featureGrant_model;
