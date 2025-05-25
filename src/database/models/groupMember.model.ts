import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { GroupMemberCreationAttributes, GroupMemberModelAttributes } from "../../types/group";



export enum GroupMemberStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    LEFT = "left",
    REMOVED = "removed"
}

export enum GroupMemberRole {
    MEMBER = "member",
    ADMIN = "admin",
    OWNER = "owner"
}

class GroupMember extends Model<GroupMemberModelAttributes, GroupMemberCreationAttributes> {
    public id!: string;
    public groupId!: string;
    public userId!: string;
    public role!: GroupMemberRole;
    public status!: GroupMemberStatus;
    public invitedBy!: string;
    public joinedAt!: Date;
    public invitedAt!: Date;
    public respondedAt!: Date | null;
    public invitationToken!: string | null;
}

const GroupMember_model = (sequelize: Sequelize) => {
    GroupMember.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: UUIDV4,
            primaryKey: true,
        },
        groupId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Groups',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        role: {
            type: DataTypes.ENUM(
                GroupMemberRole.OWNER,
                GroupMemberRole.ADMIN,
                GroupMemberRole.MEMBER
            ),
            defaultValue: GroupMemberRole.MEMBER,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM(
                GroupMemberStatus.PENDING,
                GroupMemberStatus.ACCEPTED,
                GroupMemberStatus.REJECTED,
                GroupMemberStatus.LEFT,
                GroupMemberStatus.REMOVED
            ),
            defaultValue: GroupMemberStatus.PENDING,
            allowNull: false
        },
        invitedBy: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: "ID of user who invited this member"
        },
        joinedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "When the user actually joined (accepted invitation)"
        },
        invitedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        respondedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "When the user responded to invitation"
        },
        invitationToken: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Token for email-based group invitation responses"
        },
    }, {
        sequelize,
        tableName: 'GroupMembers',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['groupId', 'userId'],
                name: 'unique_group_user'
            },
            {
                fields: ['groupId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['status']
            },
            {
                fields: ['role']
            },
            {
                fields: ['invitedBy']
            },
            {
                fields: ['invitationToken']
            }
        ]
    });

    return GroupMember;
};

export default GroupMember_model;