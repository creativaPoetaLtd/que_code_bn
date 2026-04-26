import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  OutsideMessageCreationAttributes,
  OutsideMessageModelAttributes,
} from "../../types/model";

class OutsideMessage extends Model<
  OutsideMessageModelAttributes,
  OutsideMessageCreationAttributes
> {
  public id!: string;
  public receiverId!: string;
  public senderName!: string;
  public senderContact!: string;
  public message!: string;
  public status!: "unread" | "read";
  public readAt?: Date | null;
  public source?: string;
  public meta?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const OutsideMessage_model = (sequelize: Sequelize) => {
  OutsideMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      receiverId: { type: DataTypes.UUID, allowNull: false },
      senderName: { type: DataTypes.STRING(120), allowNull: false },
      senderContact: { type: DataTypes.STRING(160), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      readAt: { type: DataTypes.DATE, allowNull: true },
      source: { type: DataTypes.STRING(40), allowNull: true, defaultValue: "welcome_page" },
      meta: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      tableName: "OutsideMessages",
    }
  );

  return OutsideMessage;
};

export default OutsideMessage_model;
