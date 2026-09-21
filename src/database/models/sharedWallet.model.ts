// sharedWallet.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletAttributes,
  SharedWalletCreationAttributes,
} from "../../types/model";

class SharedWallet extends Model<
  SharedWalletAttributes,
  SharedWalletCreationAttributes
> {
  public id!: string;
  public name!: string;
  public withdrawalPolicy!: "free" | "approval";
  public createdByUserId!: string;
  public groupId?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const SharedWallet_model = (sequelize: Sequelize) => {
  SharedWallet.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      withdrawalPolicy: {
        type: DataTypes.ENUM("free", "approval"),
        allowNull: false,
        defaultValue: "approval",
      },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      // null when this shared wallet is standalone (no attached group).
      groupId: { type: DataTypes.UUID, allowNull: true, unique: true },
    },
    { sequelize, tableName: "SharedWallets" }
  );

  return SharedWallet;
};

export default SharedWallet_model;
