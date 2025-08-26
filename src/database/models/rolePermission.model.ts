// rolePermission.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { RolePermissionAttributes, RolePermissionCreationAttributes } from "../../types/model";


class RolePermission extends Model<
  RolePermissionAttributes,
  RolePermissionCreationAttributes
> {
  public id!: string;
  public roleId!: string;
  public permissionId!: string;
}
const RolePermission_model = (sequelize: Sequelize) => {
  RolePermission.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      roleId: { type: DataTypes.UUID, allowNull: false },
      permissionId: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, tableName: "RolePermissions" }
  );

  return RolePermission;
};
export default RolePermission_model;
