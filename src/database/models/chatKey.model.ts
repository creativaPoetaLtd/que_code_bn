import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";

export interface ChatKeyAttributes {
  id: string;
  chatId: string;
  userId: string;
  encryptedKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatKeyCreationAttributes {
  chatId: string;
  userId: string;
  encryptedKey: string;
}

class ChatKey extends Model<ChatKeyAttributes, ChatKeyCreationAttributes> {
  public id!: string;
  public chatId!: string;
  public userId!: string;
  public encryptedKey!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const ChatKey_model = (sequelize: Sequelize) => {
  ChatKey.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      encryptedKey: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      tableName: "ChatKeys",
      timestamps: true,
      indexes: [
        {
          fields: ['chatId', 'userId'],
          unique: true
        }
      ]
    }
  );

  return ChatKey;
};

export default ChatKey_model;