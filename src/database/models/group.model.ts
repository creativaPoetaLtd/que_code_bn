import { DataTypes, Model, Sequelize, UUIDV4, CreationOptional } from "sequelize";
import { GroupCreationAttributes, GroupModelAttributes } from "../../types/group";

class Group extends Model<GroupModelAttributes, GroupCreationAttributes> {
    public id!: string;
    public name!: string;
    public description!: CreationOptional<string>;
    public picture!: CreationOptional<string>;
    public ownerId!: string;
    public qrCode!: CreationOptional<string>;
    public accessLink!: CreationOptional<string>;
    public accessToken!: CreationOptional<string>;
    public isPrivate!: boolean;
    public maxMembers!: CreationOptional<number>;
    public memberCount!: CreationOptional<number>;
    public createdAt!: Date;
    public updatedAt!: Date;
}

const Group_model = (sequelize: Sequelize) => {
    Group.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [2, 100]
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                len: [0, 500]
            }
        },
        picture: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "URL or path to group picture"
        },
        ownerId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        qrCode: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "QR code for group joining"
        },
        accessLink: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            comment: "Unique link for group access"
        },
        accessToken: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            comment: "Token for group access validation"
        },
        isPrivate: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            comment: "Whether group requires approval to join"
        },
        maxMembers: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 100,
            validate: {
                min: 2,
                max: 1000
            }
        },
        memberCount: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false,
            comment: "Current number of members (including owner)"
        },
    }, {
        sequelize,
        tableName: 'Groups',
        timestamps: true,
        indexes: [
            {
                fields: ['ownerId']
            },
            {
                unique: true,
                fields: ['accessLink']
            },
            {
                unique: true,
                fields: ['accessToken']
            },
            {
                fields: ['isPrivate']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    return Group;
};

export default Group_model;