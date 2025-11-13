import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";

export interface UserKeyAttributes {
  id: string;
  userId: string;
  publicKey: string;
  privateKeyEncrypted: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserKeyCreationAttributes {
  userId: string;
  publicKey: string;
  privateKeyEncrypted: string;
}

class UserKey extends Model<UserKeyAttributes, UserKeyCreationAttributes> {
  public id!: string;
  public userId!: string;
  public publicKey!: string;
  public privateKeyEncrypted!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const UserKey_model = (sequelize: Sequelize) => {
  UserKey.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      publicKey: { type: DataTypes.TEXT, allowNull: false },
      privateKeyEncrypted: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      tableName: "UserKeys",
      timestamps: true,
    }
  );

  return UserKey;
};

export default UserKey_model;