import { DataTypes, Model, Sequelize, UUIDV4, CreationOptional } from "sequelize";

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCreationAttributes {
  userId: string;
  type: string;
  data: any;
}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> {
  public id!: string;
  public userId!: string;
  public type!: string;
  public data!: any;
  public isRead!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const Notification_model = (sequelize: Sequelize) => {
  Notification.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    tableName: 'Notifications',
    timestamps: true,
  });
  return Notification;
};

export default Notification_model;
