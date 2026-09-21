import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  WhiteboardAttributes,
  WhiteboardCreationAttributes,
  WhiteboardStroke,
} from "../../types/model";

class Whiteboard extends Model<WhiteboardAttributes, WhiteboardCreationAttributes> {
  public id!: string;
  public chatId!: string;
  public groupId!: string | null;
  public createdBy!: string;
  public strokes!: WhiteboardStroke[];
  /** Bumped on every save - lets clients tell a stale copy from the current one */
  public version!: number;
  public lastEditedBy!: string | null;
  public lastEditedAt!: Date | null;
  public messageId!: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const whiteboard_model = (sequelize: Sequelize) => {
  Whiteboard.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      groupId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      strokes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      lastEditedBy: { type: DataTypes.UUID, allowNull: true },
      lastEditedAt: { type: DataTypes.DATE, allowNull: true },
      messageId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "Whiteboards" }
  );

  return Whiteboard;
};

export default whiteboard_model;
