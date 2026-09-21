import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { PollAttributes, PollCreationAttributes, PollOption } from "../../types/model";

class Poll extends Model<PollAttributes, PollCreationAttributes> {
  public id!: string;
  public chatId!: string;
  public groupId!: string | null;
  public createdBy!: string;
  public question!: string;
  public options!: PollOption[];
  public allowMultiple!: boolean;
  public isAnonymous!: boolean;
  public closesAt!: Date | null;
  public status!: "open" | "closed";
  public messageId!: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const poll_model = (sequelize: Sequelize) => {
  Poll.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      groupId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      question: { type: DataTypes.STRING, allowNull: false },
      // [{ id, text }] - option ids are stable so votes survive an edit
      options: { type: DataTypes.JSONB, allowNull: false },
      allowMultiple: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      closesAt: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM("open", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
      messageId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "Polls" }
  );

  return Poll;
};

export default poll_model;
