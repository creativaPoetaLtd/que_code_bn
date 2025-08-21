// walletRestriction.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { WalletRestrictionAttributes, WalletRestrictionCreationAttributes } from "../../types/model";

class WalletRestriction extends Model<
  WalletRestrictionAttributes,
  WalletRestrictionCreationAttributes
> {
  public id!: string;
  public walletId!: string;
  public categoryId!: string;
  public amount!: number;
}

const WalletRestriction_model = (sequelize: Sequelize) => {
  WalletRestriction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    },
    { sequelize, tableName: "WalletRestrictions" }
  );

  return WalletRestriction;
};
export default WalletRestriction_model;
