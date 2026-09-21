// sharedWalletMember.model.ts
// Membership for STANDALONE shared wallets only (no attached Group). Group-attached
// shared wallets keep using GroupMember for membership/quorum — see utils/sharedWalletContext.ts.
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletMemberAttributes,
  SharedWalletMemberCreationAttributes,
} from "../../types/model";

class SharedWalletMember extends Model<
  SharedWalletMemberAttributes,
  SharedWalletMemberCreationAttributes
> {
  public id!: string;
  public sharedWalletId!: string;
  public userId!: string;
  public role!: "owner" | "admin" | "member";
  public status!: "pending" | "active" | "left" | "removed";
  public createdAt?: Date;
  public updatedAt?: Date;
}

const SharedWalletMember_model = (sequelize: Sequelize) => {
  SharedWalletMember.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      sharedWalletId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.ENUM("owner", "admin", "member"),
        defaultValue: "member",
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "left", "removed"),
        defaultValue: "pending",
      },
    },
    {
      sequelize,
      tableName: "SharedWalletMembers",
      indexes: [{ unique: true, fields: ["sharedWalletId", "userId"] }],
    }
  );

  return SharedWalletMember;
};

export default SharedWalletMember_model;
