import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class User extends Model {
    public id!: number;
    public firstName!: string;
    public lastName!: string;
    public phone!: string;
    public email!: string;
    public address!: string;
    public idDocument!: string; // Path to the uploaded file
}

User.init(
    {
        firstName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { isEmail: true },
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        idDocument: {
            type: DataTypes.STRING, 
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "User",
        tableName: "users",
    }
);

export default User;
