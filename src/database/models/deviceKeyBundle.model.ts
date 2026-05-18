import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  DeviceKeyBundleAttributes,
  DeviceKeyBundleCreationAttributes,
} from "../../types/model";

class DeviceKeyBundle extends Model<
  DeviceKeyBundleAttributes,
  DeviceKeyBundleCreationAttributes
> {
  public id!: string;
  public userDeviceId!: string;
  public algorithm!: string;
  public identityPublicKey!: Record<string, any>;
  public signedPreKeyId!: number;
  public signedPreKeyPublic!: Record<string, any>;
  public signedPreKeySignature!: string;
  public registrationId!: number;
  public uploadedAt!: Date | null;
}

const deviceKeyBundle_model = (sequelize: Sequelize) => {
  DeviceKeyBundle.init(
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
      algorithm: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      identityPublicKey: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      signedPreKeyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      signedPreKeyPublic: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      signedPreKeySignature: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      registrationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      uploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "DeviceKeyBundles",
    },
  );

  return DeviceKeyBundle;
};

export default deviceKeyBundle_model;
