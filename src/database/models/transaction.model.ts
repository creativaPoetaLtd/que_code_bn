// transaction.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { TransactionAttributes, TransactionCreationAttributes } from "../../types/model";

class Transaction extends Model<
  TransactionAttributes,
  TransactionCreationAttributes
> {
  public id!: string;
  public referenceId!: string;
  public senderWalletId!: string;
  public receiverWalletId!: string;
  public amount!: number;
  public fee!: number;
  public totalAmount!: number;
  public currency!: string;
  public status!: "pending" | "completed" | "failed" | "cancelled";
  public type!:
    | "transfer"
    | "payment"
    | "donation"
    | "vote"
    | "topup"
    | "withdrawal";
}

const Transaction_model = (sequelize: Sequelize) => {
  Transaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      referenceId: { type: DataTypes.STRING, allowNull: false },
      senderWalletId: { type: DataTypes.UUID, allowNull: false },
      receiverWalletId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      fee: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
        defaultValue: "pending",
      },
      type: {
        type: DataTypes.ENUM(
          "transfer",
          "payment",
          "donation",
          "vote",
          "topup",
          "withdrawal"
        ),
        allowNull: false,
      },
      externalSenderName: DataTypes.STRING,
      externalSenderContact: DataTypes.STRING,
      externalSenderProvider: DataTypes.ENUM(
        "mtn_momo",
        "airtel_money",
        "bank",
        "visa",
        "mastercard",
        "paypal",
        "other"
      ),
      externalSenderReference: DataTypes.STRING,
      categoryId: DataTypes.UUID,
      spendConstraintType: DataTypes.ENUM("none", "category", "recipient"),
      constraintCategoryId: DataTypes.UUID,
      constraintRecipientWalletId: DataTypes.UUID,
      description: DataTypes.STRING,
      hasAccount: { type: DataTypes.BOOLEAN, defaultValue: true },
      senderNames: DataTypes.STRING,
      // Action-related fields (optional for backward compatibility)
      actionPurchaseId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "ActionPurchases",
          key: "id",
        },
      },
      actionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Actions",
          key: "id",
        },
      },
      subActionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "SubActions",
          key: "id",
        },
      },
    },
    { sequelize, tableName: "Transactions" }
  );

  return Transaction;
};
export default Transaction_model;
