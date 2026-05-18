// chat.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ChatAttributes, ChatCreationAttributes } from "../../types/model";

class Chat extends Model<ChatAttributes, ChatCreationAttributes> {
  public id!: string;
  public isGroup!: boolean;
  public groupId?: string;
  public type!: string;
  public securityMode!: string;
  public protocolVersion!: string | null;
}

const Chat_model = (sequelize: Sequelize) => {
  Chat.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      isGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
      groupId: DataTypes.UUID,
      type: { type: DataTypes.STRING(20), defaultValue: 'dm' },
      securityMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "legacy",
      },
      protocolVersion: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: null,
      },
    },
    { sequelize, tableName: "Chats" }
  );

  return Chat;
};
export default Chat_model;
