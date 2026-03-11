import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  AuditLogCreationAttributes,
  AuditLogModelAttributes,
} from "../../types/model";

class AuditLog extends Model<
  AuditLogModelAttributes,
  AuditLogCreationAttributes
> {
  public id!: string;
  public userId!: string | null;
  public organizationId!: string | null;
  public action!: string;
  public method!: string;
  public endpoint!: string;
  public statusCode!: number;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public requestBody!: Record<string, any> | null;
  public responseBody!: Record<string, any> | null;
  public metadata!: Record<string, any> | null;
  public duration!: number | null;
  public level!: "info" | "warning" | "error" | "critical";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const AuditLog_model = (sequelize: Sequelize) => {
  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      method: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      statusCode: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requestBody: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      responseBody: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      level: {
        type: DataTypes.ENUM("info", "warning", "error", "critical"),
        defaultValue: "info",
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "AuditLogs",
    },
  );

  return AuditLog;
};

export default AuditLog_model;
