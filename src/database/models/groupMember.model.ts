// groupMember.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { GroupMemberAttributes, GroupMemberCreationAttributes } from "../../types/model";

class GroupMember extends Model<
  GroupMemberAttributes,
  GroupMemberCreationAttributes
> {
  public id!: string;
  public groupId!: string;
  public userId!: string;
  public role!: "owner" | "admin" | "member";
  public status!: "pending" | "active" | "left" | "removed";
  public invitedBy?: string;
  public joinedAt?: Date;
  public invitedAt?: Date;
  public respondedAt?: Date;
}

const GroupMember_model = (sequelize: Sequelize) => {
  GroupMember.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      groupId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.ENUM("owner", "admin", "member"),
        defaultValue: "member",
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "left", "removed"),
        defaultValue: "pending",
      },
      invitedBy: DataTypes.UUID,
      joinedAt: DataTypes.DATE,
      invitedAt: DataTypes.DATE,
      respondedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "GroupMembers" }
  );

  return GroupMember;
};
export default GroupMember_model;
