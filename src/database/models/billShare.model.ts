// billShare.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  BillShareAttributes,
  BillShareCreationAttributes,
  BillShareStatus,
} from "../../types/model";

class BillShare extends Model<BillShareAttributes, BillShareCreationAttributes> {
  public id!: string;
  public billId!: string;
  public payerId!: string;
  public amount!: number;
  public status!: BillShareStatus;
  public paidByUserId?: string | null;
  public transactionId?: string | null;
  public declineNote?: string | null;
  public lastRemindedAt?: Date | null;
  public settledAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const billShare_model = (sequelize: Sequelize) => {
  BillShare.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      billId: { type: DataTypes.UUID, allowNull: false },
      payerId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "paid", "covered", "declined", "closed", "cancelled"),
        defaultValue: "pending",
      },
      // Who actually paid: the payer themselves for "paid", someone else for "covered".
      paidByUserId: { type: DataTypes.UUID, allowNull: true },
      transactionId: { type: DataTypes.UUID, allowNull: true },
      declineNote: { type: DataTypes.STRING, allowNull: true },
      lastRemindedAt: { type: DataTypes.DATE, allowNull: true },
      settledAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      tableName: "BillShares",
      indexes: [{ unique: true, fields: ["billId", "payerId"] }],
    }
  );

  return BillShare;
};

export default billShare_model;
