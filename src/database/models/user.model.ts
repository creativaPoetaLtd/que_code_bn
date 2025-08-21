import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { UserCreationAttributes, UserModelAttributes } from "../../types/model";

class User extends Model<UserModelAttributes, UserCreationAttributes> {
  public id!: string;
  public firstName!: string;
  public lastName!: string;
  public email!: string;
  public phone!: string;
  public password!: string;
  public isVerified!: boolean;
  public approvalStatus!: boolean;
  public otp!: string | null; // Added for OTP
  public otpExpires!: Date | null; // Added for OTP expiration

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const User_model = (sequelize: Sequelize) => {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      firstName: { type: DataTypes.STRING, allowNull: false },
      lastName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true, allowNull: false },
      phone: { type: DataTypes.STRING, unique: true, allowNull: false },
      password: { type: DataTypes.STRING, allowNull: false },
      isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
      approvalStatus: { type: DataTypes.BOOLEAN, defaultValue: false },
      otp: { type: DataTypes.STRING, allowNull: true }, // Added
      otpExpires: { type: DataTypes.DATE, allowNull: true }, // Added
    },
    {
      sequelize,
      tableName: "Users",
    }
  );

  return User;
};

export default User_model;
