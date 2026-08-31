import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { SharedNoteAttributes, SharedNoteCreationAttributes } from "../../types/model";

class SharedNote extends Model<SharedNoteAttributes, SharedNoteCreationAttributes> {
  public id!: string;
  public chatId!: string;
  public groupId!: string | null;
  public createdBy!: string;
  public title!: string;
  public content!: string;
  /** Bumped on every save - a stale version means someone else got there first */
  public version!: number;
  public lastEditedBy!: string | null;
  public lastEditedAt!: Date | null;
  public messageId!: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const sharedNote_model = (sequelize: Sequelize) => {
  SharedNote.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false },
      groupId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      lastEditedBy: { type: DataTypes.UUID, allowNull: true },
      lastEditedAt: { type: DataTypes.DATE, allowNull: true },
      messageId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: "SharedNotes" }
  );

  return SharedNote;
};

export default sharedNote_model;
