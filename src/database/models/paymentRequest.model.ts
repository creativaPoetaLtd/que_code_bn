import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { PaymentRequestAttributes, PaymentRequestCreationAttributes } from "../../types/model";

class PaymentRequest extends Model<
  PaymentRequestAttributes,
  PaymentRequestCreationAttributes
> {
  public id!: string;
  public senderId!: string;
  public recipientId!: string;
  public amount!: number;
  public currency!: string;
  public note!: string | null;
  public status!: "pending" | "paid" | "cancelled" | "expired";
  public allowEditAmount!: boolean;
  public transactionId!: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const paymentRequest_model = (sequelize: Sequelize) => {
  PaymentRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      senderId: { type: DataTypes.UUID, allowNull: false },
      recipientId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      note: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("pending", "paid", "cancelled", "expired"),
        defaultValue: "pending",
      },
      allowEditAmount: { type: DataTypes.BOOLEAN, defaultValue: false },
      transactionId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "PaymentRequests" }
  );

  return PaymentRequest;
};

export default paymentRequest_model;
