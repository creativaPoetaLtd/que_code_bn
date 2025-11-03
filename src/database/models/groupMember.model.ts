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
  public status!: "pending" | "active" | "left" | "removed" | "rejected";
  public invitedBy?: string;
  public joinedAt?: Date;
  public invitedAt?: Date;
  public respondedAt?: Date;
  public invitationMessage?: string;
  public additionalInfo?: string;
  public autoApproved!: boolean;
  public approvedBy?: string;
  public rejectedBy?: string;
  public rejectedAt?: Date;
  public rejectionReason?: string;
  public createdAt?: Date;
  public updatedAt?: Date;
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
        type: DataTypes.ENUM("pending", "active", "left", "removed", "rejected"),
        defaultValue: "pending",
      },
      invitedBy: DataTypes.UUID,
      joinedAt: DataTypes.DATE,
      invitedAt: DataTypes.DATE,
      respondedAt: DataTypes.DATE,
      invitationMessage: DataTypes.TEXT,
      additionalInfo: DataTypes.TEXT,
      autoApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
      approvedBy: DataTypes.UUID,
      rejectedBy: DataTypes.UUID,
      rejectedAt: DataTypes.DATE,
      rejectionReason: DataTypes.TEXT,
    },
    { sequelize, tableName: "GroupMembers" }
  );

  return GroupMember;
};
export default GroupMember_model;
