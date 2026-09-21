// sharedWalletPolicyChangeVote.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SharedWalletPolicyChangeVoteAttributes,
  SharedWalletPolicyChangeVoteCreationAttributes,
} from "../../types/model";

class SharedWalletPolicyChangeVote extends Model<
  SharedWalletPolicyChangeVoteAttributes,
  SharedWalletPolicyChangeVoteCreationAttributes
> {
  public id!: string;
  public policyChangeId!: string;
  public userId!: string;
  public decision!: "approve" | "decline";
  public createdAt?: Date;
  public updatedAt?: Date;
}

const sharedWalletPolicyChangeVote_model = (sequelize: Sequelize) => {
  SharedWalletPolicyChangeVote.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      policyChangeId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      decision: {
        type: DataTypes.ENUM("approve", "decline"),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "SharedWalletPolicyChangeVotes",
      indexes: [{ unique: true, fields: ["policyChangeId", "userId"] }],
    }
  );

  return SharedWalletPolicyChangeVote;
};

export default sharedWalletPolicyChangeVote_model;
