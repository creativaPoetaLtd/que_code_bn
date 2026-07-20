import { Op } from "sequelize";

const SUPPORTED_E2EE_ALGORITHMS = new Set(["qc-e2ee-p256-v1"]);

type RegisterDeviceInput = {
  deviceId: string;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  bundle: {
    algorithm: string;
    identityPublicKey: Record<string, any>;
    signedPreKey: {
      keyId: number;
      publicKey: Record<string, any>;
      signature: string;
    };
    registrationId: number;
    oneTimePreKeys: Array<{
      keyId: number;
      publicKey: Record<string, any>;
    }>;
  };
};

const assertValidBundle = (input: RegisterDeviceInput) => {
  if (!input.deviceId || input.deviceId.length < 12 || input.deviceId.length > 128) {
    throw Object.assign(new Error("A valid deviceId is required"), { statusCode: 400 });
  }

  if (!SUPPORTED_E2EE_ALGORITHMS.has(input.bundle?.algorithm)) {
    throw Object.assign(new Error("Unsupported E2EE algorithm"), { statusCode: 400 });
  }

  if (!input.bundle?.identityPublicKey || !input.bundle?.signedPreKey?.publicKey) {
    throw Object.assign(new Error("A valid device key bundle is required"), { statusCode: 400 });
  }

  if (
    !Number.isInteger(input.bundle.signedPreKey.keyId) ||
    !Number.isInteger(input.bundle.registrationId)
  ) {
    throw Object.assign(new Error("Invalid signed pre-key metadata"), { statusCode: 400 });
  }

  if (!Array.isArray(input.bundle.oneTimePreKeys) || input.bundle.oneTimePreKeys.length === 0) {
    throw Object.assign(new Error("At least one one-time pre-key is required"), { statusCode: 400 });
  }

  if (input.bundle.oneTimePreKeys.length > 100) {
    throw Object.assign(new Error("Too many one-time pre-keys submitted"), { statusCode: 400 });
  }
};

export const upsertUserDeviceBundle = async (
  models: any,
  userId: string,
  input: RegisterDeviceInput,
) => {
  assertValidBundle(input);

  const existingForDeviceId = await models.UserDevice.findOne({
    where: { deviceId: input.deviceId },
  });

  if (existingForDeviceId && existingForDeviceId.userId !== userId) {
    throw Object.assign(
      new Error("This device identity is already bound to another account"),
      { statusCode: 409 },
    );
  }

  const [device] = await models.UserDevice.findOrCreate({
    where: { deviceId: input.deviceId },
    defaults: {
      userId,
      deviceId: input.deviceId,
      deviceName: input.deviceName || null,
      platform: input.platform || null,
      appVersion: input.appVersion || null,
      isActive: true,
      lastSeenAt: new Date(),
      revokedAt: null,
    },
  });

  await device.update({
    userId,
    deviceName: input.deviceName || device.deviceName || null,
    platform: input.platform || device.platform || null,
    appVersion: input.appVersion || device.appVersion || null,
    isActive: true,
    lastSeenAt: new Date(),
    revokedAt: null,
  });

  const [bundle] = await models.DeviceKeyBundle.findOrCreate({
    where: { userDeviceId: device.id },
    defaults: {
      userDeviceId: device.id,
      algorithm: input.bundle.algorithm,
      identityPublicKey: input.bundle.identityPublicKey,
      signedPreKeyId: input.bundle.signedPreKey.keyId,
      signedPreKeyPublic: input.bundle.signedPreKey.publicKey,
      signedPreKeySignature: input.bundle.signedPreKey.signature,
      registrationId: input.bundle.registrationId,
      uploadedAt: new Date(),
    },
  });

  await bundle.update({
    algorithm: input.bundle.algorithm,
    identityPublicKey: input.bundle.identityPublicKey,
    signedPreKeyId: input.bundle.signedPreKey.keyId,
    signedPreKeyPublic: input.bundle.signedPreKey.publicKey,
    signedPreKeySignature: input.bundle.signedPreKey.signature,
    registrationId: input.bundle.registrationId,
    uploadedAt: new Date(),
  });

  await models.DeviceOneTimePreKey.destroy({
    where: {
      userDeviceId: device.id,
      usedAt: null,
    },
  });

  await models.DeviceOneTimePreKey.bulkCreate(
    input.bundle.oneTimePreKeys.map((preKey) => ({
      userDeviceId: device.id,
      preKeyId: preKey.keyId,
      publicKey: preKey.publicKey,
      usedAt: null,
    })),
  );

  return {
    device,
    bundle,
    availableOneTimePreKeys: input.bundle.oneTimePreKeys.length,
  };
};

export const listUserDevices = async (models: any, userId: string) => {
  return models.UserDevice.findAll({
    where: { userId },
    include: [
      {
        model: models.DeviceKeyBundle,
        as: "keyBundle",
        required: false,
      },
      {
        model: models.DeviceOneTimePreKey,
        as: "oneTimePreKeys",
        required: false,
        where: {
          usedAt: null,
        },
      },
    ],
    order: [["createdAt", "ASC"]],
  });
};

const hasActiveContactBetween = async (models: any, requesterId: string, targetUserId: string) => {
  const contact = await models.Contact.findOne({
    where: {
      status: "active",
      [Op.or]: [
        { userAId: requesterId, userBId: targetUserId },
        { userAId: targetUserId, userBId: requesterId },
      ],
    },
  });

  return Boolean(contact);
};

export const getUserDeviceBundles = async (
  models: any,
  requesterId: string,
  targetUserId: string,
) => {
  const allowed =
    requesterId === targetUserId ||
    (await hasActiveContactBetween(models, requesterId, targetUserId));

  if (!allowed) {
    throw Object.assign(
      new Error("You can only fetch secure device bundles for yourself or active contacts"),
      { statusCode: 403 },
    );
  }

  return models.UserDevice.findAll({
    where: {
      userId: targetUserId,
      isActive: true,
      revokedAt: null,
    },
    include: [
      {
        model: models.DeviceKeyBundle,
        as: "keyBundle",
        required: true,
      },
      {
        model: models.DeviceOneTimePreKey,
        as: "oneTimePreKeys",
        required: false,
        where: { usedAt: null },
      },
    ],
    order: [["createdAt", "ASC"]],
  });
};
