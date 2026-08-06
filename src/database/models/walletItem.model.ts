// walletItem.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  WalletItemAttributes,
  WalletItemCreationAttributes,
} from "../../types/model";

class WalletItem extends Model<
  WalletItemAttributes,
  WalletItemCreationAttributes
> {
  public id!: string;
  public walletId!: string;
  public itemType!: WalletItemAttributes["itemType"];
  public referenceId!: string | null;
  public title!: string;
  public subtitle!: string | null;
  public imageUrl!: string | null;
  public metadata!: any;
  public status!: WalletItemAttributes["status"];
  public isPinned!: boolean;
  public expiresAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const WalletItem_model = (sequelize: Sequelize) => {
  WalletItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      itemType: {
        type: DataTypes.ENUM(
          "voucher",
          "pass",
          "saved_action",
          "custom_card",
          "transferred_item",
          "action_purchase_ref"
        ),
        allowNull: false,
      },
      referenceId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING, allowNull: false },
      subtitle: { type: DataTypes.STRING, allowNull: true },
      imageUrl: { type: DataTypes.STRING, allowNull: true },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: DataTypes.ENUM("active", "used", "expired", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      isPinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "WalletItems" }
  );

  return WalletItem;
};
export default WalletItem_model;
