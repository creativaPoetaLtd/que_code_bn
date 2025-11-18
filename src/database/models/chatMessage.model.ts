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
  public messageType!: "text" | "image" | "file" | "money" | "audio" | "video" | "document";
  public transactionId?: string;
  public isEncrypted!: boolean;
  public encryptionIv?: string;
  public status!: "sent" | "delivered" | "read";
  public deliveredAt?: Date;
  public readAt?: Date;
  // Media fields
  public mediaUrl?: string;
  public mediaType?: string;
  public fileSize?: number;
  public thumbnailUrl?: string;
  public fileName?: string;
  public mimeType?: string;
  public duration?: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const ChatMessage_model = (sequelize: Sequelize) => {
  ChatMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      senderId: { type: DataTypes.UUID, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      messageType: {
        type: DataTypes.ENUM("text", "image", "file", "money", "audio", "video", "document"),
        allowNull: false,
      },
      transactionId: DataTypes.UUID,
      isEncrypted: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
      encryptionIv: { type: DataTypes.STRING, allowNull: true },
      status: { 
        type: DataTypes.ENUM("sent", "delivered", "read"), 
        defaultValue: "sent", 
        allowNull: false 
      },
      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
      // Media fields
      mediaUrl: { type: DataTypes.TEXT, allowNull: true },
      mediaType: { type: DataTypes.STRING, allowNull: true },
      fileSize: { type: DataTypes.INTEGER, allowNull: true },
      thumbnailUrl: { type: DataTypes.TEXT, allowNull: true },
      fileName: { type: DataTypes.STRING, allowNull: true },
      mimeType: { type: DataTypes.STRING, allowNull: true },
      duration: { type: DataTypes.INTEGER, allowNull: true },
    },
    { 
      sequelize, 
      tableName: "ChatMessages",
      timestamps: true,
      indexes: [
        {
          fields: ['chatId', 'createdAt']
        },
        {
          fields: ['senderId']
        },
        {
          fields: ['mediaUrl']
        }
      ]
    }
  );

  return ChatMessage;
};
export default ChatMessage_model;
