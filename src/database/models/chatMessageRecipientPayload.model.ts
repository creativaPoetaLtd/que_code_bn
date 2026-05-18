import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  ChatMessageRecipientPayloadAttributes,
  ChatMessageRecipientPayloadCreationAttributes,
} from "../../types/model";

class ChatMessageRecipientPayload extends Model<
  ChatMessageRecipientPayloadAttributes,
  ChatMessageRecipientPayloadCreationAttributes
> {
  public id!: string;
  public chatMessageId!: string;
  public recipientUserId!: string;
  public recipientDeviceId!: string;
  public senderDeviceId!: string;
  public encryptedEnvelope!: Record<string, any>;
  public deliveredAt!: Date | null;
  public readAt!: Date | null;
}

const chatMessageRecipientPayload_model = (sequelize: Sequelize) => {
  ChatMessageRecipientPayload.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      chatMessageId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      recipientUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      recipientDeviceId: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      senderDeviceId: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      encryptedEnvelope: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "ChatMessageRecipientPayloads",
      indexes: [
        {
          fields: ["chatMessageId"],
        },
        {
          fields: ["recipientUserId", "recipientDeviceId"],
        },
        {
          unique: true,
          fields: ["chatMessageId", "recipientDeviceId"],
        },
      ],
    },
  );

  return ChatMessageRecipientPayload;
};

export default chatMessageRecipientPayload_model;
