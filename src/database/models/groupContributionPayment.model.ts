import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  GroupContributionPaymentAttributes,
  GroupContributionPaymentCreationAttributes,
} from "../../types/model";

class GroupContributionPayment extends Model<
  GroupContributionPaymentAttributes,
  GroupContributionPaymentCreationAttributes
> {
  public id!: string;
  public contributionId!: string;
  public payerId!: string;
  public amount!: number;
  public transactionId!: string | null;
  public currency!: string;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const groupContributionPayment_model = (sequelize: Sequelize) => {
  GroupContributionPayment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      contributionId: { type: DataTypes.UUID, allowNull: false },
      payerId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      transactionId: { type: DataTypes.UUID, allowNull: true },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
    },
    { sequelize, tableName: "GroupContributionPayments" }
  );

  return GroupContributionPayment;
};

export default groupContributionPayment_model;
