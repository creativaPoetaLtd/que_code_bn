// externalAccount.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ExternalAccountAttributes, ExternalAccountCreationAttributes } from "../../types/model";

class ExternalAccount extends Model<
  ExternalAccountAttributes,
  ExternalAccountCreationAttributes
> {
  public id!: string;
  public provider!:
    | "mtn_momo"
    | "airtel_money"
    | "visa"
    | "mastercard"
    | "bank";
  public accountNumber!: string;
  public isDefault!: boolean;
}

const ExternalAccount_model = (sequelize: Sequelize) => {
  ExternalAccount.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: DataTypes.UUID,
      organizationId: DataTypes.UUID,
      provider: {
        type: DataTypes.ENUM(
          "mtn_momo",
          "airtel_money",
          "visa",
          "mastercard",
          "bank"
        ),
        allowNull: false,
      },
      accountNumber: { type: DataTypes.STRING, allowNull: false },
      providerRef: DataTypes.STRING,
      label: DataTypes.STRING,
      isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, tableName: "ExternalAccounts" }
  );

  return ExternalAccount;
};
export default ExternalAccount_model;
