// payment.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { PaymentAttributes, PaymentCreationAttributes } from "../../types/model";

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> {
  public id!: string;
  public linkId!: string;
  public url!: string;
  public amount!: number;
  public isActive!: boolean;
}

const Payment_model = (sequelize: Sequelize) => {
  Payment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: DataTypes.UUID,
      organizationId: DataTypes.UUID,
      linkId: { type: DataTypes.STRING, allowNull: false, unique: true },
      url: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      description: DataTypes.STRING,
      expiresAt: DataTypes.DATE,
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      maxUsage: { type: DataTypes.INTEGER, defaultValue: 1 },
    },
    { sequelize, tableName: "Payments" }
  );

  return Payment;
};
export default Payment_model;
