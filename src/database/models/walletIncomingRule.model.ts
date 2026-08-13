// walletIncomingRule.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  WalletIncomingRuleAttributes,
  WalletIncomingRuleCreationAttributes,
} from "../../types/model";

/**
 * A receiver-driven rule: money arriving in `walletId` from `senderWalletId`
 * is automatically filed into `categoryId` (creating/growing a WalletRestriction
 * envelope). `cap` is a PER-PAYMENT limit: at most `cap` of each incoming payment
 * is filed (the rest stays free); no cap means the whole payment is filed.
 * `restrictedTotal` tracks the running total this rule has filed (informational).
 * When the sender explicitly tags a payment with its own category, that takes
 * precedence over this rule.
 */
class WalletIncomingRule extends Model<
  WalletIncomingRuleAttributes,
  WalletIncomingRuleCreationAttributes
> {
  public id!: string;
  public walletId!: string;
  public senderWalletId!: string;
  public categoryId!: string;
  public cap!: number | null;
  public restrictedTotal!: number;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association placeholders
  public category?: any;
  public senderWallet?: any;
}

const WalletIncomingRule_model = (sequelize: Sequelize) => {
  WalletIncomingRule.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      senderWalletId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      cap: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      restrictedTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: "WalletIncomingRules",
      indexes: [
        { unique: true, fields: ["walletId", "senderWalletId"] },
      ],
    }
  );

  return WalletIncomingRule;
};
export default WalletIncomingRule_model;
