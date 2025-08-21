// contact.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ContactAttributes, ContactCreationAttributes } from "../../types/model";

class Contact extends Model<ContactAttributes, ContactCreationAttributes> {
  public id!: string;
  public userAId!: string;
  public userBId!: string;
  public status!: "active" | "blocked";
}

const Contact_model = (sequelize: Sequelize) => {
  Contact.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userAId: { type: DataTypes.UUID, allowNull: false },
      userBId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM("active", "blocked"),
        defaultValue: "active",
      },
    },
    { sequelize, tableName: "Contacts" }
  );

  return Contact;
};
export default Contact_model;
