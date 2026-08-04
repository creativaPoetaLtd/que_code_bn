// transferBatch.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  TransferBatchAttributes,
  TransferBatchCreationAttributes,
} from "../../types/model";

class TransferBatch extends Model<
  TransferBatchAttributes,
  TransferBatchCreationAttributes
> {
  public id!: string;
  public createdByUserId!: string;
  public senderUserId?: string | null;
  public senderOrganizationId?: string | null;
  public senderSubActionId?: string | null;
  public currency!: string;
  public type!:
    | "transfer"
    | "payment"
    | "donation"
    | "vote"
    | "topup"
    | "withdrawal";
  public description?: string | null;
  public categoryId?: string | null;
  public applyConstraints!: boolean;
  public idempotencyKey?: string | null;
  public recipientCount!: number;
  public totalRequestedAmount!: number;
  public totalSentAmount!: number;
  public totalFailedAmount!: number;
  public successCount!: number;
  public failureCount!: number;
  public status!: "completed" | "partial" | "failed";
  public failures?: Array<Record<string, any>> | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const transferBatch_model = (sequelize: Sequelize) => {
  TransferBatch.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      senderUserId: DataTypes.UUID,
      senderOrganizationId: DataTypes.UUID,
      senderSubActionId: DataTypes.UUID,
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      type: {
        type: DataTypes.ENUM(
          "transfer",
          "payment",
          "donation",
          "vote",
          "topup",
          "withdrawal"
        ),
        defaultValue: "transfer",
      },
      description: DataTypes.STRING,
      categoryId: DataTypes.UUID,
      applyConstraints: { type: DataTypes.BOOLEAN, defaultValue: false },
      idempotencyKey: { type: DataTypes.STRING, allowNull: true, unique: true },
      recipientCount: { type: DataTypes.INTEGER, allowNull: false },
      totalRequestedAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      totalSentAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      totalFailedAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      successCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      failureCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("completed", "partial", "failed"),
        defaultValue: "completed",
      },
      failures: { type: DataTypes.JSONB, allowNull: true },
    },
    { sequelize, tableName: "TransferBatches" }
  );

  return TransferBatch;
};

export default transferBatch_model;
