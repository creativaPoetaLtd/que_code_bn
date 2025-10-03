import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { GroupChatSettingsAttributes, GroupChatSettingsCreationAttributes } from "../../types/model";

class GroupChatSettings extends Model<
  GroupChatSettingsAttributes,
  GroupChatSettingsCreationAttributes
> {
  public id!: string;
  public groupId!: string;
  public canMembersInvite!: boolean;
  public canMembersDeleteMessages!: boolean;
  public onlyAdminsCanPost!: boolean;
  public messageRetentionDays?: number;
  public allowFileSharing!: boolean;
  public allowMoneyTransfers!: boolean;
  public maxFileSize?: number;
  public allowedFileTypes?: string[];
  public profanityFilter!: boolean;
  public linkPreview!: boolean;
  public readReceipts!: boolean;
  public typingIndicators!: boolean;
  public slowMode?: number;
  public announcementMode!: boolean;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const GroupChatSettings_model = (sequelize: Sequelize) => {
  GroupChatSettings.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      groupId: { 
        type: DataTypes.UUID, 
        allowNull: false,
        unique: true,
        references: {
          model: "Groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      canMembersInvite: { type: DataTypes.BOOLEAN, defaultValue: true },
      canMembersDeleteMessages: { type: DataTypes.BOOLEAN, defaultValue: false },
      onlyAdminsCanPost: { type: DataTypes.BOOLEAN, defaultValue: false },
      messageRetentionDays: { type: DataTypes.INTEGER, allowNull: true },
      allowFileSharing: { type: DataTypes.BOOLEAN, defaultValue: true },
      allowMoneyTransfers: { type: DataTypes.BOOLEAN, defaultValue: true },
      maxFileSize: { type: DataTypes.INTEGER, defaultValue: 10485760 }, // 10MB default
      allowedFileTypes: { 
        type: DataTypes.JSON, 
        defaultValue: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "txt", "mp4", "mp3"]
      },
      profanityFilter: { type: DataTypes.BOOLEAN, defaultValue: false },
      linkPreview: { type: DataTypes.BOOLEAN, defaultValue: true },
      readReceipts: { type: DataTypes.BOOLEAN, defaultValue: true },
      typingIndicators: { type: DataTypes.BOOLEAN, defaultValue: true },
      slowMode: { type: DataTypes.INTEGER, allowNull: true }, // seconds between messages
      announcementMode: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { 
      sequelize, 
      tableName: "GroupChatSettings",
      indexes: [
        {
          unique: true,
          fields: ["groupId"]
        }
      ]
    }
  );

  return GroupChatSettings;
};

export default GroupChatSettings_model;