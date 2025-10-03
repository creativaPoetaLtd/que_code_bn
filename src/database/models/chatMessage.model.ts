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
  public messageType!: "text" | "image" | "file" | "money" | "system" | "announcement";
  public transactionId?: string;
  public metadata?: any;
  public replyToMessageId?: string;
  public isEdited!: boolean;
  public editedAt?: Date;
  public deletedAt?: Date;
  public readBy?: any;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const ChatMessage_model = (sequelize: Sequelize) => {
  ChatMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      senderId: { type: DataTypes.UUID, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      messageType: {
        type: DataTypes.ENUM("text", "image", "file", "money", "system", "announcement"),
        allowNull: false,
        defaultValue: "text"
      },
      transactionId: DataTypes.UUID,
      metadata: { type: DataTypes.JSON, allowNull: true },
      replyToMessageId: { type: DataTypes.UUID, allowNull: true },
      isEdited: { type: DataTypes.BOOLEAN, defaultValue: false },
      editedAt: { type: DataTypes.DATE, allowNull: true },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
      readBy: { type: DataTypes.JSON, defaultValue: [] }
    },
    { 
      sequelize, 
      tableName: "ChatMessages",
      paranoid: true 
    }
  );

  return ChatMessage;
};
export default ChatMessage_model;
