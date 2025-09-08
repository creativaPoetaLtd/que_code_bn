// group.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { GroupAttributes, GroupCreationAttributes } from "../../types/model";

class Group extends Model<GroupAttributes, GroupCreationAttributes> {
  public id!: string;
  public name!: string;
  public description?: string;
  public picture?: string;
  public ownerId!: string;
  public qrCode?: string;
  public accessLink?: string;
  public accessToken?: string;
  public isPrivate!: boolean;
  public maxMembers?: number;
  public memberCount?: number;
  public walletId?: string;
  public lifeTime?: number;
  public createdAt?: Date;
  public updatedAt?: Date;
}

const Group_model = (sequelize: Sequelize) => {
  Group.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.STRING,
      picture: DataTypes.STRING,
      ownerId: { type: DataTypes.UUID, allowNull: false },
      qrCode: DataTypes.STRING,
      accessLink: DataTypes.STRING,
      accessToken: DataTypes.STRING,
      isPrivate: { type: DataTypes.BOOLEAN, defaultValue: true },
      maxMembers: DataTypes.INTEGER,
      memberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      walletId: DataTypes.UUID,
      lifeTime: DataTypes.INTEGER,
    },
    { sequelize, tableName: "Groups" }
  );

  return Group;
};
export default Group_model;
