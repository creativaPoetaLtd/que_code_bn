// topUp.model.ts
// One request to pull money from the payer's mobile money into a QC wallet.
// Lifecycle: pending -> successful (wallet credited, transactionId set) | failed | expired.
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  TopUpAttributes,
  TopUpCreationAttributes,
  TopUpProviderKey,
  TopUpStatus,
} from "../../types/model";

class TopUp extends Model<TopUpAttributes, TopUpCreationAttributes> {
  public id!: string;
  public walletId!: string;
  public userId?: string | null;
  public organizationId?: string | null;
  public amount!: number;
  public currency!: string;
  public provider!: TopUpProviderKey;
  public phoneNumber!: string;
  public note?: string | null;
  public status!: TopUpStatus;
  public simulated!: boolean;
  public providerReference?: string | null;
  public failureReason?: string | null;
  public transactionId?: string | null;
  public completedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const topUp_model = (sequelize: Sequelize) => {
  TopUp.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: true },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      provider: { type: DataTypes.ENUM("mtn_momo", "airtel_money"), allowNull: false },
      phoneNumber: { type: DataTypes.STRING, allowNull: false },
      note: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("pending", "successful", "failed", "expired"),
        defaultValue: "pending",
      },
      simulated: { type: DataTypes.BOOLEAN, defaultValue: false },
      providerReference: { type: DataTypes.STRING, allowNull: true },
      failureReason: { type: DataTypes.STRING, allowNull: true },
      transactionId: { type: DataTypes.UUID, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "TopUps" }
  );

  return TopUp;
};

export default topUp_model;
