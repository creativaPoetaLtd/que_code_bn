// group.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { GroupAttributes, GroupCreationAttributes } from "../../types/model";

class Group extends Model<GroupAttributes, GroupCreationAttributes> {
  public id!: string;
  public name!: string;
  public description?: string;
  public picture?: string;
  public ownerId!: string;
  public adminId?: string;
  public qrCode?: string;
  public accessLink?: string;
  public accessToken?: string;
  public isPrivate!: boolean;
  public privacyType!: string;
  public maxMembers?: number;
  public memberCount?: number;
  public hasFundraising!: boolean;
  public fundraisingTarget?: number;
  public fundraisingCurrentAmount!: number;
  public expirationDate?: Date;
  public expirationType!: string;
  public hasAdditionalInfo!: boolean;
  public additionalInfoPrompt?: string;
  public profilePictureUrl?: string;
  public profilePicturePublicId?: string;
  public walletId?: string;
  public lifeTime?: number;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const Group_model = (sequelize: Sequelize) => {
  Group.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.STRING,
      picture: DataTypes.STRING,
      ownerId: { type: DataTypes.UUID, allowNull: false },
      adminId: { type: DataTypes.UUID, allowNull: true },
      qrCode: DataTypes.TEXT,
      accessLink: DataTypes.STRING,
      accessToken: DataTypes.STRING,
      isPrivate: { type: DataTypes.BOOLEAN, defaultValue: true },
      privacyType: { 
        type: DataTypes.ENUM("private", "public", "require_approval"), 
        defaultValue: "require_approval" 
      },
      maxMembers: DataTypes.INTEGER,
      memberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      hasFundraising: { type: DataTypes.BOOLEAN, defaultValue: false },
      fundraisingTarget: DataTypes.DECIMAL(15, 2),
      fundraisingCurrentAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
      expirationDate: DataTypes.DATE,
      expirationType: { 
        type: DataTypes.ENUM("custom_date", "target_reached", "deadline_reached", "never"), 
        defaultValue: "never" 
      },
      hasAdditionalInfo: { type: DataTypes.BOOLEAN, defaultValue: false },
      additionalInfoPrompt: DataTypes.TEXT,
      profilePictureUrl: DataTypes.STRING,
      profilePicturePublicId: DataTypes.STRING,
      walletId: DataTypes.UUID,
      lifeTime: DataTypes.INTEGER,
    },
    { sequelize, tableName: "Groups" }
  );

  return Group;
};
export default Group_model;
