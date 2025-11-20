import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  ActionPurchaseCreationAttributes,
  ActionPurchaseModelAttributes,
} from "../../types/model";

class ActionPurchase extends Model<
  ActionPurchaseModelAttributes,
  ActionPurchaseCreationAttributes
> {
  public id!: string;
  public actionId!: string;
  public subActionId!: string | null;
  public buyerId!: string;
  public organizationId!: string;
  public transactionId!: string; // Links to existing Transaction
  public quantity!: number;
  public unitPrice!: number;
  public totalAmount!: number;
  public currency!: string;
  public buyerData!: any; // JSON: { name, email, phone, custom fields }
  public status!: "pending" | "completed" | "cancelled" | "refunded";
  public qrObjectId!: string | null; // Links to QRObject

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const ActionPurchase_model = (sequelize: Sequelize) => {
  ActionPurchase.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      actionId: {
        type: DataTypes.UUID,
        allowNull: false,
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
      buyerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Organizations",
          key: "id",
        },
      },
      transactionId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "Transactions",
          key: "id",
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "RWF",
      },
      buyerData: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "completed",
          "cancelled",
          "refunded"
        ),
        defaultValue: "pending",
      },
      qrObjectId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "QRObjects",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "ActionPurchases",
    }
  );

  return ActionPurchase;
};

export default ActionPurchase_model;

