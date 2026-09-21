// sharedWalletWithdrawal.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletWithdrawalAttributes,
  SharedWalletWithdrawalCreationAttributes,
} from "../../types/model";

class SharedWalletWithdrawal extends Model<
  SharedWalletWithdrawalAttributes,
  SharedWalletWithdrawalCreationAttributes
> {
  public id!: string;
  public sharedWalletId!: string;
  public walletId!: string;
  public requestedByUserId!: string;
  public amount!: number;
  public currency!: string;
  public note?: string | null;
  public status!: "pending" | "approved" | "declined" | "cancelled";
  public requiredApprovals!: number;
  public approveCount!: number;
  public declineCount!: number;
  public chatMessageId?: string | null;
  public transactionId?: string | null;
  public decidedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const sharedWalletWithdrawal_model = (sequelize: Sequelize) => {
  SharedWalletWithdrawal.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      sharedWalletId: { type: DataTypes.UUID, allowNull: false },
      walletId: { type: DataTypes.UUID, allowNull: false },
      requestedByUserId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      note: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("pending", "approved", "declined", "cancelled"),
        defaultValue: "pending",
      },
      // Snapshotted at proposal time: floor(otherActiveMembers / 2) + 1.
      requiredApprovals: { type: DataTypes.INTEGER, allowNull: false },
      approveCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      declineCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      chatMessageId: { type: DataTypes.UUID, allowNull: true },
      transactionId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "SharedWalletWithdrawals" }
  );

  return SharedWalletWithdrawal;
};

export default sharedWalletWithdrawal_model;
