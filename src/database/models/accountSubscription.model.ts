// accountSubscription.model.ts
// A monthly paid plan (PREMIUM, VIP, FREELANCE, ...) for a user or an organization.
// The account's live tier is the accountTier column; this row tracks billing for it.
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  AccountSubscriptionAttributes,
  AccountSubscriptionCreationAttributes,
  AccountSubscriptionStatus,
} from "../../types/model";
import { AccountTier } from "../../utils/accountTiers";

class AccountSubscription extends Model<
  AccountSubscriptionAttributes,
  AccountSubscriptionCreationAttributes
> {
  public id!: string;
  public userId?: string | null;
  public organizationId?: string | null;
  public tier!: AccountTier;
  public pendingTier?: AccountTier | null;
  public priceRwf!: number;
  public status!: AccountSubscriptionStatus;
  public autoRenew!: boolean;
  public currentPeriodStart!: Date;
  public currentPeriodEnd!: Date;
  public pastDueSince?: Date | null;
  public lastChargeTransactionId?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const accountSubscription_model = (sequelize: Sequelize) => {
  AccountSubscription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      tier: { type: DataTypes.STRING, allowNull: false },
      pendingTier: { type: DataTypes.STRING, allowNull: true },
      priceRwf: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM("active", "past_due", "cancelled", "expired"),
        defaultValue: "active",
      },
      autoRenew: { type: DataTypes.BOOLEAN, defaultValue: true },
      currentPeriodStart: { type: DataTypes.DATE, allowNull: false },
      currentPeriodEnd: { type: DataTypes.DATE, allowNull: false },
      pastDueSince: { type: DataTypes.DATE, allowNull: true },
      lastChargeTransactionId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "AccountSubscriptions" }
  );

  return AccountSubscription;
};

export default accountSubscription_model;
