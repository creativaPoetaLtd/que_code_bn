// contact.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { ContactAttributes, ContactCreationAttributes } from "../../types/model";

class Contact extends Model<ContactAttributes, ContactCreationAttributes> {
  public id!: string;
  public userAId!: string;
  public userBId!: string;
  public status!: "active" | "blocked";
  public userAIsFavorite!: boolean;
  public userBIsFavorite!: boolean;
  public userATags!: string[];
  public userBTags!: string[];
  public createdAt?: Date;
  public updatedAt?: Date;

  // Association methods will be added by Sequelize
  public userA?: any;
  public userB?: any;
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
        allowNull: false,
      },
      userAIsFavorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      userBIsFavorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      userATags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: false
      },
      userBTags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: false
      }
    },
    {
      sequelize,
      tableName: "Contacts",
      indexes: [
        {
          fields: ["userAId"]
        },
        {
          fields: ["userBId"]
        },
        {
          fields: ["status"]
        }
      ]
    }
  );

  return Contact;
};

export default Contact_model;
