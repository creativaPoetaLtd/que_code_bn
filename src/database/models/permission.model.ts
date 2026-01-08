// permission.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  PermissionAttributes,
  PermissionCreationAttributes,
} from "../../types/model";

class Permission extends Model<
  PermissionAttributes,
  PermissionCreationAttributes
> {
  public id!: string;
  public name!: string;
  public description!: string;
}
const Permission_model = (sequelize: Sequelize) => {
  Permission.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: DataTypes.STRING,
    },
    { sequelize, tableName: "Permissions" }
  );

  return Permission;
};
export default Permission_model;
