// wallet.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { WalletAttributes, WalletCreationAttributes } from "../../types/model";

class Wallet extends Model<WalletAttributes, WalletCreationAttributes> {
  public id!: string;
  public userId?: string;
  public organizationId?: string;
  public groupId?: string;
  public subActionId?: string;
  public balance!: number;
  public currency!: string;
  public isActive!: boolean;
}

const Wallet_model = (sequelize: Sequelize) => {
  Wallet.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: DataTypes.UUID,
      organizationId: DataTypes.UUID,
      groupId: DataTypes.UUID,
      subActionId: DataTypes.UUID,
      balance: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
      currency: { type: DataTypes.STRING, defaultValue: "RWF" },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, tableName: "Wallets" }
  );

  return Wallet;
};
export default Wallet_model;
