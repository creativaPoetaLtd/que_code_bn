import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  QRObjectCreationAttributes,
  QRObjectModelAttributes,
} from "../../types/model";

class QRObject extends Model<QRObjectModelAttributes, QRObjectCreationAttributes> {
  public id!: string;
  public buyerId!: string;
  public actionId!: string;
  public actionPurchaseId!: string;
  public subActionId!: string | null;
  public type!:
    | "eticket"
    | "badge"
    | "license"
    | "membership"
    | "booking"
    | "transport"
    | "subscription";
  public metadata!: any; // JSON: { seat, gate, validOn, etc. }
  public status!: "valid" | "used" | "expired" | "revoked";
  public issuedAt!: Date;
  public validUntil!: Date | null;
  public usedAt!: Date | null;
  public qrCodeData!: string; // Base64 QR code data URL
  public coverImage!: string | null; // Cover image URL from the action

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const QRObject_model = (sequelize: Sequelize) => {
  QRObject.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      buyerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      actionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Actions",
          key: "id",
        },
      },
      actionPurchaseId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "ActionPurchases",
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
      type: {
        type: DataTypes.ENUM(
          "eticket",
          "badge",
          "license",
          "membership",
          "booking",
          "transport",
          "subscription"
        ),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: DataTypes.ENUM("valid", "used", "expired", "revoked"),
        defaultValue: "valid",
      },
      issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      validUntil: { type: DataTypes.DATE, allowNull: true },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      qrCodeData: { type: DataTypes.TEXT, allowNull: false },
      coverImage: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      tableName: "QRObjects",
    }
  );

  return QRObject;
};

export default QRObject_model;

