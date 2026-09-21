// sharedWalletWithdrawalVote.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletWithdrawalVoteAttributes,
  SharedWalletWithdrawalVoteCreationAttributes,
} from "../../types/model";

class SharedWalletWithdrawalVote extends Model<
  SharedWalletWithdrawalVoteAttributes,
  SharedWalletWithdrawalVoteCreationAttributes
> {
  public id!: string;
  public withdrawalId!: string;
  public userId!: string;
  public decision!: "approve" | "decline";
  public createdAt?: Date;
  public updatedAt?: Date;
}

const sharedWalletWithdrawalVote_model = (sequelize: Sequelize) => {
  SharedWalletWithdrawalVote.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      withdrawalId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      decision: {
        type: DataTypes.ENUM("approve", "decline"),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "SharedWalletWithdrawalVotes",
      indexes: [{ unique: true, fields: ["withdrawalId", "userId"] }],
    }
  );

  return SharedWalletWithdrawalVote;
};

export default sharedWalletWithdrawalVote_model;
