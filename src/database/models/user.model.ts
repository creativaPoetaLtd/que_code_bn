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
  public transactionPin!: string | null; // Hashed 4-digit PIN for transactions
  public hasPinSet!: boolean; // Whether user has set up their PIN
  public pinAttempts!: number; // Number of failed PIN attempts
  public pinLockedUntil!: Date | null; // Temporary lockout timestamp
  public isOnline!: boolean; // Online status
  public lastSeen!: Date | null; // Last seen timestamp
  public pinResetOtp!: string | null; // OTP for PIN reset
  public pinResetOtpExpires!: Date | null; // PIN reset OTP expiration
  public fcmToken!: string | null; // Firebase Cloud Messaging token

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
      transactionPin: { type: DataTypes.STRING, allowNull: true }, // Hashed PIN
      hasPinSet: { type: DataTypes.BOOLEAN, defaultValue: false }, // PIN setup status
      pinAttempts: { type: DataTypes.INTEGER, defaultValue: 0 }, // Failed attempts counter
      pinLockedUntil: { type: DataTypes.DATE, allowNull: true }, // Lockout timestamp
      isOnline: { type: DataTypes.BOOLEAN, defaultValue: false }, // Online status
      lastSeen: { type: DataTypes.DATE, allowNull: true }, // Last seen timestamp
      pinResetOtp: { type: DataTypes.STRING, allowNull: true }, // PIN reset OTP
      pinResetOtpExpires: { type: DataTypes.DATE, allowNull: true }, // PIN reset OTP expiration
      fcmToken: { type: DataTypes.TEXT, allowNull: true }, // FCM token
    },
    {
      sequelize,
      tableName: "Users",
    }
  );

  return User;
};

export default User_model;
