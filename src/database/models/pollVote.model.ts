import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { PollVoteAttributes, PollVoteCreationAttributes } from "../../types/model";

class PollVote extends Model<PollVoteAttributes, PollVoteCreationAttributes> {
  public id!: string;
  public pollId!: string;
  public userId!: string;
  public optionId!: string;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const pollVote_model = (sequelize: Sequelize) => {
  PollVote.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      pollId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      optionId: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      tableName: "PollVotes",
      indexes: [
        // One row per person per option; a re-vote replaces the previous rows
        { unique: true, fields: ["pollId", "userId", "optionId"] },
      ],
    }
  );

  return PollVote;
};

export default pollVote_model;
