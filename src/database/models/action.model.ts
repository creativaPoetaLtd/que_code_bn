import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  ActionCreationAttributes,
  ActionModelAttributes,
} from "../../types/model";

class Action extends Model<ActionModelAttributes, ActionCreationAttributes> {
  public id!: string;
  public organizationId!: string;
  public type!:
    | "ticket"
    | "transport"
    | "service"
    | "subscription"
    | "payment"
    | "donation"
    | "vote"
    | "booking"
    | "license"
    | "membership"
    | "rental"
    | "group";
  public name!: string;
  public slug!: string;
  public displayLayout!: "mosaic" | "list" | "icons" | "card";
  public coverImage!: string | null;
  public shortDescription!: string | null;
  public description!: string | null;
  public currency!: string;
  public taxProfileId!: string | null;
  public pricing!: any; // JSON: { mode: "fixed"|"free"|"range"|"tiered", amount?: number, min?: number, max?: number }
  public availability!: any; // JSON: { startsAt?: string, endsAt?: string, timezone?: string, userQuota?: number, salesWindow?: any }
  public visibility!: any; // JSON: { mode: "public"|"unlisted"|"private", whitelist?: string[] }
  public buyerFields!: any; // JSON: string[] - ["fullName", "email", "phone", ...]
  public fulfillment!: any; // JSON: { storeOnBuyerQR: boolean, objectType?: "eticket"|"badge"|"license"|"membership", postPurchaseMessage?: string }
  public policy!: any; // JSON: { refund?: string, tosUrl?: string, cancellation?: string }
  public webhooks!: any; // JSON: { onCheckout?: string, onScanValid?: string, onRefund?: string }
  public customFields!: any; // JSON: type-specific fields
  public status!: "draft" | "published" | "archived";
  public dedicatedQrCode!: string | null;
  public dedicatedQrCodeData!: string | null; // Base64 QR code data URL

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const Action_model = (sequelize: Sequelize) => {
  Action.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Organizations",
          key: "id",
        },
      },
      type: {
        type: DataTypes.ENUM(
          "ticket",
          "transport",
          "service",
          "subscription",
          "payment",
          "donation",
          "vote",
          "booking",
          "license",
          "membership",
          "rental",
          "group"
        ),
        allowNull: false,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      displayLayout: {
        type: DataTypes.ENUM("mosaic", "list", "icons", "card"),
        defaultValue: "card",
      },
      coverImage: { type: DataTypes.TEXT, allowNull: true },
      shortDescription: { type: DataTypes.STRING(140), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "RWF" },
      taxProfileId: { type: DataTypes.UUID, allowNull: true },
      pricing: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { mode: "fixed", amount: 0 },
      },
      availability: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      visibility: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { mode: "public" },
      },
      buyerFields: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      fulfillment: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { storeOnBuyerQR: false },
      },
      policy: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      webhooks: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      customFields: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: DataTypes.ENUM("draft", "published", "archived"),
        defaultValue: "draft",
      },
      dedicatedQrCode: { type: DataTypes.TEXT, allowNull: true },
      dedicatedQrCodeData: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: "Base64 QR code data URL for the action"
      },
    },
    {
      sequelize,
      tableName: "Actions",
    }
  );

  return Action;
};

export default Action_model;

