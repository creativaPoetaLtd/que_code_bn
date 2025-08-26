// chat.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ChatAttributes, ChatCreationAttributes } from "../../types/model";

class Chat extends Model<ChatAttributes, ChatCreationAttributes> {
  public id!: string;
  public isGroup!: boolean;
  public groupId?: string;
}

const Chat_model = (sequelize: Sequelize) => {
  Chat.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      isGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
      groupId: DataTypes.UUID,
    },
    { sequelize, tableName: "Chats" }
  );

  return Chat;
};
export default Chat_model;
