// chatMessage.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ChatMessageAttributes, ChatMessageCreationAttributes } from "../../types/model";


class ChatMessage extends Model<
  ChatMessageAttributes,
  ChatMessageCreationAttributes
> {
  public id!: string;
  public chatId!: string;
  public senderId!: string;
  public content!: string;
  public messageType!: "text" | "image" | "file" | "money";
}

const ChatMessage_model = (sequelize: Sequelize) => {
  ChatMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      senderId: { type: DataTypes.UUID, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      messageType: {
        type: DataTypes.ENUM("text", "image", "file", "money"),
        allowNull: false,
      },
      transactionId: DataTypes.UUID,
    },
    { sequelize, tableName: "ChatMessages" }
  );

  return ChatMessage;
};
export default ChatMessage_model;
