// role.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { RoleAttributes, RoleCreationAttributes } from "../../types/model";

class Role extends Model<RoleAttributes, RoleCreationAttributes> {
  public id!: string;
  public name!: string;
}
const Role_model = (sequelize: Sequelize) => {
  Role.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: DataTypes.STRING,
    },
    { sequelize, tableName: "Roles" }
  );

  return Role;
};
export default Role_model;
