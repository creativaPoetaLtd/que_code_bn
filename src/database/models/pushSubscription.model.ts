import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  PushSubscriptionAttributes,
  PushSubscriptionCreationAttributes,
} from "../../types/model";

class PushSubscription extends Model<
  PushSubscriptionAttributes,
  PushSubscriptionCreationAttributes
> {
  public id!: string;
  public userId!: string;
  public endpoint!: string;
  public subscription!: PushSubscriptionAttributes["subscription"];
  public userAgent!: string | null;
  public isActive!: boolean;
  public lastSeenAt!: Date | null;
  public lastSuccessfulAt!: Date | null;
  public lastFailureAt!: Date | null;
  public lastFailureReason!: string | null;
}

const PushSubscription_model = (sequelize: Sequelize) => {
  PushSubscription.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      endpoint: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      subscription: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastSuccessfulAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastFailureAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastFailureReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "PushSubscriptions",
    },
  );

  return PushSubscription;
};

export default PushSubscription_model;
