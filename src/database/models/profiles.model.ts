import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  ProfileCreationAttributes,
  ProfileModelAttributes,
} from "../../types/model";

class Profile extends Model<ProfileModelAttributes, ProfileCreationAttributes> {
  public id!: string;
  public type!: "individual" | "organization";
  public userId?: string;
  public organizationId?: string;
  public instagram?: string;
  public facebook?: string;
  public twitter?: string;
  public linkedin?: string;
  public province?: string;
  public district?: string;
  public sector?: string;
  public cell?: string;
  public logo?: string;
  public operationalDocument?: string;
  public tinNumber?: string;
  public profileImage?: string;
  public statusMessage?: string;
  public qrCode!: string;
  public showPhoneOnWelcome!: boolean;
  public showProfileImageOnWelcome!: boolean;
  public showStatusMessageOnWelcome!: boolean;
  public showProfileTypeOnWelcome!: boolean;
  public showLocationOnWelcome!: boolean;
  public showTinOnWelcome!: boolean;
  public showLogoOnWelcome!: boolean;
  public showCategoryOnWelcome!: boolean;
  public showSocialLinksOnWelcome!: boolean;
  public showGalleryOnWelcome!: boolean;
  public showOrgStatsOnWelcome!: boolean;
  public showActionsOnWelcome!: boolean;
  public showSendMoneyOnWelcome!: boolean;
  public showContactFormOnWelcome!: boolean;
  public showOtherInfoOnWelcome!: boolean;
  public showFriendRequestOnWelcome!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const Profile_model = (sequelize: Sequelize) => {
  Profile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      type: {
        type: DataTypes.ENUM("individual", "organization"),
        allowNull: false,
      },
      userId: { type: DataTypes.UUID, allowNull: true },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      instagram: DataTypes.STRING,
      facebook: DataTypes.STRING,
      twitter: DataTypes.STRING,
      linkedin: DataTypes.STRING,
      province: DataTypes.STRING,
      district: DataTypes.STRING,
      sector: DataTypes.STRING,
      cell: DataTypes.STRING,
      logo: DataTypes.STRING,
      operationalDocument: DataTypes.STRING,
      tinNumber: DataTypes.STRING,
      profileImage: DataTypes.STRING,
      statusMessage: DataTypes.STRING,
      qrCode: { type: DataTypes.TEXT, unique: true, allowNull: false },
      showPhoneOnWelcome: { type: DataTypes.BOOLEAN, defaultValue: true },
      showProfileImageOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showStatusMessageOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showProfileTypeOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showLocationOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showTinOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showLogoOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showCategoryOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showSocialLinksOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showGalleryOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showOrgStatsOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showActionsOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showSendMoneyOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showContactFormOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showOtherInfoOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showFriendRequestOnWelcome: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: "Profiles",
    }
  );

  return Profile;
};

export default Profile_model;
