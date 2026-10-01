// bill.model.ts
// A one-off "split payment": one recipient (a user OR an organization), a fixed total,
// and N BillShares - each an exact amount owed by one named payer, paid directly to the
// recipient's wallet (no pooling).
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { BillAttributes, BillCreationAttributes } from "../../types/model";

class Bill extends Model<BillAttributes, BillCreationAttributes> {
  public id!: string;
  public organizerId!: string;
  public recipientUserId?: string | null;
  public recipientOrganizationId?: string | null;
  public totalAmount!: number;
  public currency!: string;
  public title!: string;
  public note?: string | null;
  public status!: "open" | "completed" | "cancelled";
  public completedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const bill_model = (sequelize: Sequelize) => {
  Bill.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      organizerId: { type: DataTypes.UUID, allowNull: false },
      recipientUserId: { type: DataTypes.UUID, allowNull: true },
      recipientOrganizationId: { type: DataTypes.UUID, allowNull: true },
      totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      title: { type: DataTypes.STRING, allowNull: false },
      note: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("open", "completed", "cancelled"),
        defaultValue: "open",
      },
      completedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "Bills" }
  );

  return Bill;
};

export default bill_model;
