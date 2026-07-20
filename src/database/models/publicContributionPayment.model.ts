import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  PublicContributionPaymentAttributes,
  PublicContributionPaymentCreationAttributes,
} from "../../types/model";

class PublicContributionPayment extends Model<
  PublicContributionPaymentAttributes,
  PublicContributionPaymentCreationAttributes
> {
  public id!: string;
  public contributionId!: string;
  public payerId!: string;
  public amount!: number;
  public transactionId!: string | null;
  public currency!: string;
  public isAnonymous!: boolean;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const publicContributionPayment_model = (sequelize: Sequelize) => {
  PublicContributionPayment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      contributionId: { type: DataTypes.UUID, allowNull: false },
      payerId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      transactionId: { type: DataTypes.UUID, allowNull: true },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      isAnonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, tableName: "PublicContributionPayments" }
  );

  return PublicContributionPayment;
};

export default publicContributionPayment_model;
