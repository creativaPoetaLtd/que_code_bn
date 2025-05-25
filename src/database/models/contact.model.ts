import { DataTypes, Sequelize, UUIDV4 } from "sequelize";
import { Contact, ContactStatus } from "../../types/contact";

const contact_model = (sequelize: Sequelize) => {
    Contact.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: UUIDV4,
            primaryKey: true,
        },
        inviterId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        inviteeId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM(ContactStatus.PENDING, ContactStatus.ACCEPTED, ContactStatus.REJECTED),
            defaultValue: ContactStatus.PENDING,
            allowNull: false
        },
        invitedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        respondedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        invitationToken: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Token for email-based invitation responses"
        }
    }, {
        sequelize,
        tableName: 'Contacts',
        indexes: [
            {
                unique: true,
                fields: ['inviterId', 'inviteeId']
            },
            {
                fields: ["invitationToken"],
            },
            {
                fields: ['status']
            }
        ]
    });

    return Contact;
};

export default contact_model;