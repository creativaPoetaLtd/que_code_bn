// contactInvitation.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ContactInvitationAttributes, ContactInvitationCreationAttributes } from "../../types/model";


class ContactInvitation extends Model<
  ContactInvitationAttributes,
  ContactInvitationCreationAttributes
> {
  public id!: string;
  public inviterId!: string;
  public inviteeId!: string;
  public status!: "pending" | "accepted" | "declined" | "expired";
}

const ContactInvitation_model = (sequelize: Sequelize) => {
  ContactInvitation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      inviterId: { type: DataTypes.UUID, allowNull: false },
      inviteeId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "accepted", "declined", "expired"),
        defaultValue: "pending",
      },
      invitationToken: { type: DataTypes.STRING, allowNull: false },
      invitedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      respondedAt: DataTypes.DATE,
      expiresAt: DataTypes.DATE,
    },
    { sequelize, tableName: "ContactInvitations" }
  );

  return ContactInvitation;
};
export default ContactInvitation_model;
