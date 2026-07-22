import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  UserDeviceAttributes,
  UserDeviceCreationAttributes,
} from "../../types/model";

class UserDevice extends Model<UserDeviceAttributes, UserDeviceCreationAttributes> {
  public id!: string;
  public userId!: string;
  public deviceId!: string;
  public deviceName!: string | null;
  public platform!: string | null;
  public appVersion!: string | null;
  public isActive!: boolean;
  public lastSeenAt!: Date | null;
  public revokedAt!: Date | null;
}

const userDevice_model = (sequelize: Sequelize) => {
  UserDevice.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      deviceId: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      deviceName: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      platform: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "UserDevices",
    },
  );

  return UserDevice;
};

export default userDevice_model;
