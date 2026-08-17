// escrow.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { EscrowAttributes, EscrowCreationAttributes } from "../../types/model";

class Escrow extends Model<EscrowAttributes, EscrowCreationAttributes> {
  public id!: string;
  public chatId?: string | null;
  public payerWalletId!: string;
  public payeeWalletId!: string;
  public payerUserId!: string;
  public payeeUserId!: string;
  public amount!: number;
  public currency!: string;
  public description?: string | null;
  public status!:
    | "held"
    | "released"
    | "refunded"
    | "disputed"
    | "cancelled"
    | "expired";
  public releaseMode!: "manual" | "auto_timeout";
  public autoReleaseAt?: Date | null;
  public fundedAt!: Date;
  public fulfilledAt?: Date | null;
  public releasedAt?: Date | null;
  public refundedAt?: Date | null;
  public releaseTransactionId?: string | null;
  public disputeRaisedBy?: string | null;
  public disputeReason?: string | null;
  public disputeRaisedAt?: Date | null;
  public disputeResponse?: string | null;
  public disputeRespondedBy?: string | null;
  public disputeRespondedAt?: Date | null;
  public resolvedByAdminId?: string | null;
  public resolutionNote?: string | null;
  public resolvedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const escrow_model = (sequelize: Sequelize) => {
  Escrow.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: DataTypes.UUID,
      payerWalletId: { type: DataTypes.UUID, allowNull: false },
      payeeWalletId: { type: DataTypes.UUID, allowNull: false },
      payerUserId: { type: DataTypes.UUID, allowNull: false },
      payeeUserId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      description: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM(
          "held",
          "released",
          "refunded",
          "disputed",
          "cancelled",
          "expired"
        ),
        defaultValue: "held",
      },
      releaseMode: {
        type: DataTypes.ENUM("manual", "auto_timeout"),
        defaultValue: "manual",
      },
      autoReleaseAt: { type: DataTypes.DATE, allowNull: true },
      fundedAt: { type: DataTypes.DATE, allowNull: false },
      fulfilledAt: { type: DataTypes.DATE, allowNull: true },
      releasedAt: { type: DataTypes.DATE, allowNull: true },
      refundedAt: { type: DataTypes.DATE, allowNull: true },
      releaseTransactionId: { type: DataTypes.UUID, allowNull: true },
      disputeRaisedBy: { type: DataTypes.UUID, allowNull: true },
      disputeReason: { type: DataTypes.STRING, allowNull: true },
      disputeRaisedAt: { type: DataTypes.DATE, allowNull: true },
      disputeResponse: { type: DataTypes.STRING, allowNull: true },
      disputeRespondedBy: { type: DataTypes.UUID, allowNull: true },
      disputeRespondedAt: { type: DataTypes.DATE, allowNull: true },
      resolvedByAdminId: { type: DataTypes.UUID, allowNull: true },
      resolutionNote: { type: DataTypes.STRING, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "Escrows" }
  );

  return Escrow;
};

export default escrow_model;
