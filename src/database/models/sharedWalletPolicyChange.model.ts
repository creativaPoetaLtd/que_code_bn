// sharedWalletPolicyChange.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletPolicyChangeAttributes,
  SharedWalletPolicyChangeCreationAttributes,
} from "../../types/model";

class SharedWalletPolicyChange extends Model<
  SharedWalletPolicyChangeAttributes,
  SharedWalletPolicyChangeCreationAttributes
> {
  public id!: string;
  public sharedWalletId!: string;
  public proposedByUserId!: string;
  public targetPolicy!: "free" | "approval";
  public status!: "pending" | "approved" | "declined" | "cancelled";
  public requiredApprovals!: number;
  public approveCount!: number;
  public declineCount!: number;
  public decidedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const sharedWalletPolicyChange_model = (sequelize: Sequelize) => {
  SharedWalletPolicyChange.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      sharedWalletId: { type: DataTypes.UUID, allowNull: false },
      proposedByUserId: { type: DataTypes.UUID, allowNull: false },
      targetPolicy: { type: DataTypes.ENUM("free", "approval"), allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "approved", "declined", "cancelled"),
        defaultValue: "pending",
      },
      // Snapshotted at proposal time: floor(otherActiveMembers / 2) + 1.
      requiredApprovals: { type: DataTypes.INTEGER, allowNull: false },
      approveCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      declineCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "SharedWalletPolicyChanges" }
  );

  return SharedWalletPolicyChange;
};

export default sharedWalletPolicyChange_model;
