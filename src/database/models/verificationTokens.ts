// verificationToken.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { VerificationTokenAttributes, VerificationTokenCreationAttributes } from "../../types/model";

class VerificationToken extends Model<
  VerificationTokenAttributes,
  VerificationTokenCreationAttributes
> {
  public id!: string;
  public userId!: string;
  public type!: "password_reset" | "email_verification" | "phone_verification";
  public token!: string;
  public expiresAt!: Date;
}

const VerificationToken_model = (sequelize: Sequelize) => {
  VerificationToken.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: {
        type: DataTypes.ENUM(
          "password_reset",
          "email_verification",
          "phone_verification"
        ),
        allowNull: false,
      },
      token: { type: DataTypes.STRING, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, tableName: "VerificationTokens" }
  );

  return VerificationToken;
};
export default VerificationToken_model;
