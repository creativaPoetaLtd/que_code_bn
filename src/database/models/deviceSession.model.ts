import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  DeviceSessionAttributes,
  DeviceSessionCreationAttributes,
} from "../../types/model";

class DeviceSession extends Model<
  DeviceSessionAttributes,
  DeviceSessionCreationAttributes
> {
  public id!: string;
  public userId!: string | null;
  public organizationId!: string | null;
  public accountType!: "user" | "organization";
  public refreshTokenHash!: string;
  public userAgent!: string | null;
  public ipAddress!: string | null;
  public isActive!: boolean;
  public lastUsedAt!: Date | null;
  public revokedAt!: Date | null;
  public expiresAt!: Date;
}

const deviceSession_model = (sequelize: Sequelize) => {
  DeviceSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      accountType: {
        type: DataTypes.ENUM("user", "organization"),
        allowNull: false,
      },
      refreshTokenHash: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "DeviceSessions",
    },
  );

  return DeviceSession;
};

export default deviceSession_model;
