// userRole.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { UserRoleAttributes, UserRoleCreationAttributes } from "../../types/model";

class UserRole extends Model<UserRoleAttributes, UserRoleCreationAttributes> {
  public id!: string;
  public userId!: string;
  public roleId!: string;
}
const UserRole_model = (sequelize: Sequelize) => {
  UserRole.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      roleId: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, tableName: "UserRoles" }
  );

  return UserRole;
};
export default UserRole_model;
