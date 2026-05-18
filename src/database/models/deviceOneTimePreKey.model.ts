import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  DeviceOneTimePreKeyAttributes,
  DeviceOneTimePreKeyCreationAttributes,
} from "../../types/model";

class DeviceOneTimePreKey extends Model<
  DeviceOneTimePreKeyAttributes,
  DeviceOneTimePreKeyCreationAttributes
> {
  public id!: string;
  public userDeviceId!: string;
  public preKeyId!: number;
  public publicKey!: Record<string, any>;
  public usedAt!: Date | null;
}

const deviceOneTimePreKey_model = (sequelize: Sequelize) => {
  DeviceOneTimePreKey.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      userDeviceId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      preKeyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      publicKey: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "DeviceOneTimePreKeys",
    },
  );

  return DeviceOneTimePreKey;
};

export default deviceOneTimePreKey_model;
