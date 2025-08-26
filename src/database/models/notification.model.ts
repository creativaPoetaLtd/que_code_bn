// notification.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { NotificationAttributes, NotificationCreationAttributes } from "../../types/model";
class Notification extends Model<
  NotificationAttributes,
  NotificationCreationAttributes
> {
  public id!: string;
  public userId!: string;
  public type!: string;
  public data!: object;
  public isRead!: boolean;
}

const Notification_model = (sequelize: Sequelize) => {
  Notification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      data: { type: DataTypes.JSON, allowNull: false },
      isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, tableName: "Notifications" }
  );

  return Notification;
};
export default Notification_model;
