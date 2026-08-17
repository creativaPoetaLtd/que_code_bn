// scheduledTransfer.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  ScheduledTransferAttributes,
  ScheduledTransferCreationAttributes,
} from "../../types/model";

class ScheduledTransfer extends Model<
  ScheduledTransferAttributes,
  ScheduledTransferCreationAttributes
> {
  public id!: string;
  public createdByUserId!: string;
  public senderUserId?: string | null;
  public senderOrganizationId?: string | null;
  public senderSubActionId?: string | null;
  public receiverUserId?: string | null;
  public receiverOrganizationId?: string | null;
  public receiverWalletId?: string | null;
  public amount!: number;
  public fee!: number;
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
  public scheduledFor!: Date;
  public timezone!: string;
  public recurrenceRule!: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    endDate?: string;
    maxOccurrences?: number;
  } | null;
  public occurrenceCount!: number;
  public status!:
    | "scheduled"
    | "held"
    | "executing"
    | "completed"
    | "failed"
    | "cancelled"
    | "paused";
  public heldAmount?: number | null;
  public heldAt?: Date | null;
  public idempotencyKey!: string;
  public lastExecutedTransactionId?: string | null;
  public consecutiveFailureCount!: number;
  public lastFailureReason?: string | null;
  public pinVerifiedAt?: Date | null;
  public scheduledBatchId?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const scheduledTransfer_model = (sequelize: Sequelize) => {
  ScheduledTransfer.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      senderUserId: DataTypes.UUID,
      senderOrganizationId: DataTypes.UUID,
      senderSubActionId: DataTypes.UUID,
      receiverUserId: DataTypes.UUID,
      receiverOrganizationId: DataTypes.UUID,
      receiverWalletId: DataTypes.UUID,
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      fee: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
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
      scheduledFor: { type: DataTypes.DATE, allowNull: false },
      timezone: { type: DataTypes.STRING, defaultValue: "Africa/Kigali" },
      recurrenceRule: { type: DataTypes.JSONB, allowNull: true },
      occurrenceCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM(
          "scheduled",
          "held",
          "executing",
          "completed",
          "failed",
          "cancelled",
          "paused"
        ),
        defaultValue: "scheduled",
      },
      heldAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      heldAt: { type: DataTypes.DATE, allowNull: true },
      idempotencyKey: { type: DataTypes.STRING, allowNull: false, unique: true },
      lastExecutedTransactionId: { type: DataTypes.UUID, allowNull: true },
      consecutiveFailureCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      lastFailureReason: DataTypes.STRING,
      pinVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      scheduledBatchId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "ScheduledTransfers" }
  );

  return ScheduledTransfer;
};

export default scheduledTransfer_model;
