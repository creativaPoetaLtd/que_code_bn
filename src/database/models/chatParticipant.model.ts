// chatParticipant.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ChatParticipantAttributes, ChatParticipantCreationAttributes } from "../../types/model";

class ChatParticipant extends Model<
  ChatParticipantAttributes,
  ChatParticipantCreationAttributes
> {
  public id!: string;
  public chatId!: string;
  public userId!: string;
  public joinedAt!: Date;
  public lastReadAt?: Date;
}

const ChatParticipant_model = (sequelize: Sequelize) => {
  ChatParticipant.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      lastReadAt: DataTypes.DATE,
    },
    { 
      sequelize, 
      tableName: "ChatParticipants",
      indexes: [
        {
          unique: true,
          fields: ['chatId', 'userId']
        }
      ]
    }
  );

  return ChatParticipant;
};
export default ChatParticipant_model;
