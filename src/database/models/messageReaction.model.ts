import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";

export interface MessageReactionAttributes {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageReactionCreationAttributes
  extends Omit<MessageReactionAttributes, "id"> {}

class MessageReaction extends Model<
  MessageReactionAttributes,
  MessageReactionCreationAttributes
> {
  public id!: string;
  public messageId!: string;
  public userId!: string;
  public emoji!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const MessageReaction_model = (sequelize: Sequelize) => {
  MessageReaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      messageId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      emoji: { type: DataTypes.STRING(16), allowNull: false },
    },
    {
      sequelize,
      tableName: "MessageReactions",
      timestamps: true,
      indexes: [
        { fields: ["messageId"] },
        // One reaction per user per message (upsert semantics)
        { unique: true, fields: ["messageId", "userId"] },
      ],
    }
  );

  return MessageReaction;
};

export default MessageReaction_model;
