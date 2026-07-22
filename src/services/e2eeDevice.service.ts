import { Op } from "sequelize";
import { webcrypto } from "crypto";

const SUPPORTED_E2EE_ALGORITHMS = new Set(["qc-e2ee-p256-v1"]);
const MAX_DB_SAFE_PREKEY_ID = 2_147_483_646;

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
};

const isValidP256Coordinate = (value: unknown) => {
  if (typeof value !== "string" || value.length < 40) {
    return false;
  }

  try {
    return decodeBase64Url(value).length === 32;
  } catch {
    return false;
  }
};

const isValidP256PublicJwk = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const jwk = value as Record<string, unknown>;
  return (
    jwk.kty === "EC" &&
    jwk.crv === "P-256" &&
    isValidP256Coordinate(jwk.x) &&
    isValidP256Coordinate(jwk.y)
  );
};

const hasValidSecureBundleShape = (device: any) =>
  isValidP256PublicJwk(device?.keyBundle?.identityPublicKey) &&
  isValidP256PublicJwk(device?.keyBundle?.signedPreKeyPublic) &&
  typeof device?.keyBundle?.signedPreKeySignature === "string" &&
  device.keyBundle.signedPreKeySignature.length > 20;

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

const verifySignedPreKeySignature = async ({
  identityPublicKey,
  signedPreKeyPublic,
  signature,
}: {
  identityPublicKey: Record<string, any>;
  signedPreKeyPublic: Record<string, any>;
  signature: string;
}) => {
  try {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      identityPublicKey as JsonWebKey,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["verify"],
    );

    return webcrypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-256",
      },
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(stableStringify(signedPreKeyPublic)),
    );
  } catch {
    return false;
  }
};

const assertValidBundle = async (input: RegisterDeviceInput) => {
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
    !isValidP256PublicJwk(input.bundle.identityPublicKey) ||
    !isValidP256PublicJwk(input.bundle.signedPreKey.publicKey)
  ) {
    throw Object.assign(new Error("Device bundle contains an invalid P-256 public key"), {
      statusCode: 400,
    });
  }

  if (
    !Number.isInteger(input.bundle.signedPreKey.keyId) ||
    input.bundle.signedPreKey.keyId <= 0 ||
    input.bundle.signedPreKey.keyId > MAX_DB_SAFE_PREKEY_ID ||
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

  assertValidOneTimePreKeys(input.bundle.oneTimePreKeys);

  const validSignature = await verifySignedPreKeySignature({
    identityPublicKey: input.bundle.identityPublicKey,
    signedPreKeyPublic: input.bundle.signedPreKey.publicKey,
    signature: input.bundle.signedPreKey.signature,
  });

  if (!validSignature) {
    throw Object.assign(new Error("Invalid signed pre-key signature"), { statusCode: 400 });
  }
};

const assertValidOneTimePreKeys = (
  oneTimePreKeys: Array<{ keyId: number; publicKey: Record<string, any> }>,
) => {
  const seenIds = new Set<number>();

  for (const preKey of oneTimePreKeys) {
    if (
      !Number.isInteger(preKey?.keyId) ||
      preKey.keyId <= 0 ||
      preKey.keyId > MAX_DB_SAFE_PREKEY_ID
    ) {
      throw Object.assign(new Error("Invalid one-time pre-key metadata"), { statusCode: 400 });
    }

    if (seenIds.has(preKey.keyId)) {
      throw Object.assign(new Error("Duplicate one-time pre-key id"), { statusCode: 400 });
    }

    if (!isValidP256PublicJwk(preKey.publicKey)) {
      throw Object.assign(new Error("One-time pre-key contains an invalid P-256 public key"), {
        statusCode: 400,
      });
    }

    seenIds.add(preKey.keyId);
  }
};

const assertValidSignedPreKey = (signedPreKey: {
  keyId: number;
  publicKey: Record<string, any>;
  signature: string;
}) => {
  if (
    !Number.isInteger(signedPreKey?.keyId) ||
    signedPreKey.keyId <= 0 ||
    signedPreKey.keyId > MAX_DB_SAFE_PREKEY_ID
  ) {
    throw Object.assign(new Error("Invalid signed pre-key metadata"), { statusCode: 400 });
  }

  if (!isValidP256PublicJwk(signedPreKey.publicKey)) {
    throw Object.assign(new Error("Signed pre-key contains an invalid P-256 public key"), {
      statusCode: 400,
    });
  }

  if (typeof signedPreKey.signature !== "string" || signedPreKey.signature.length <= 20) {
    throw Object.assign(new Error("Invalid signed pre-key signature"), { statusCode: 400 });
  }
};

export const upsertUserDeviceBundle = async (
  models: any,
  userId: string,
  input: RegisterDeviceInput,
) => {
  await assertValidBundle(input);

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

export const revokeUserDevice = async (
  models: any,
  userId: string,
  deviceId: string,
) => {
  if (!deviceId) {
    throw Object.assign(new Error("deviceId is required"), { statusCode: 400 });
  }

  const device = await models.UserDevice.findOne({
    where: {
      userId,
      deviceId,
      isActive: true,
      revokedAt: null,
    },
  });

  if (!device) {
    throw Object.assign(new Error("Active secure device not found"), { statusCode: 404 });
  }

  const revokedAt = new Date();
  await device.update({
    isActive: false,
    revokedAt,
    lastSeenAt: revokedAt,
  });

  await models.DeviceOneTimePreKey.destroy({
    where: {
      userDeviceId: device.id,
      usedAt: null,
    },
  });

  return {
    deviceId: device.deviceId,
    revokedAt,
  };
};

const getOwnedActiveDevice = async (models: any, userId: string, deviceId: string) => {
  if (!deviceId) {
    throw Object.assign(new Error("deviceId is required"), { statusCode: 400 });
  }

  const device = await models.UserDevice.findOne({
    where: {
      userId,
      deviceId,
      isActive: true,
      revokedAt: null,
    },
    include: [
      {
        model: models.DeviceKeyBundle,
        as: "keyBundle",
        required: true,
      },
    ],
  });

  if (!device) {
    throw Object.assign(new Error("Active secure device not found"), { statusCode: 404 });
  }

  return device;
};

export const rotateUserDeviceSignedPreKey = async (
  models: any,
  userId: string,
  deviceId: string,
  signedPreKey: {
    keyId: number;
    publicKey: Record<string, any>;
    signature: string;
  },
) => {
  assertValidSignedPreKey(signedPreKey);
  const device = await getOwnedActiveDevice(models, userId, deviceId);
  const validSignature = await verifySignedPreKeySignature({
    identityPublicKey: device.keyBundle.identityPublicKey,
    signedPreKeyPublic: signedPreKey.publicKey,
    signature: signedPreKey.signature,
  });

  if (!validSignature) {
    throw Object.assign(new Error("Invalid signed pre-key signature"), { statusCode: 400 });
  }

  await device.keyBundle.update({
    signedPreKeyId: signedPreKey.keyId,
    signedPreKeyPublic: signedPreKey.publicKey,
    signedPreKeySignature: signedPreKey.signature,
    uploadedAt: new Date(),
  });

  await device.update({
    lastSeenAt: new Date(),
  });

  return {
    deviceId: device.deviceId,
    signedPreKeyId: signedPreKey.keyId,
    uploadedAt: device.keyBundle.uploadedAt,
  };
};

export const appendUserDeviceOneTimePreKeys = async (
  models: any,
  userId: string,
  deviceId: string,
  oneTimePreKeys: Array<{ keyId: number; publicKey: Record<string, any> }>,
) => {
  if (!Array.isArray(oneTimePreKeys) || oneTimePreKeys.length === 0) {
    throw Object.assign(new Error("At least one one-time pre-key is required"), { statusCode: 400 });
  }

  if (oneTimePreKeys.length > 100) {
    throw Object.assign(new Error("Too many one-time pre-keys submitted"), { statusCode: 400 });
  }

  assertValidOneTimePreKeys(oneTimePreKeys);
  const device = await getOwnedActiveDevice(models, userId, deviceId);
  const preKeyIds = oneTimePreKeys.map((preKey) => preKey.keyId);
  const existing = await models.DeviceOneTimePreKey.findAll({
    where: {
      userDeviceId: device.id,
      preKeyId: { [Op.in]: preKeyIds },
    },
  });

  if (existing.length > 0) {
    throw Object.assign(new Error("One-time pre-key id already exists for this device"), {
      statusCode: 409,
    });
  }

  await models.DeviceOneTimePreKey.bulkCreate(
    oneTimePreKeys.map((preKey) => ({
      userDeviceId: device.id,
      preKeyId: preKey.keyId,
      publicKey: preKey.publicKey,
      usedAt: null,
    })),
  );

  await device.update({
    lastSeenAt: new Date(),
  });

  return {
    deviceId: device.deviceId,
    addedOneTimePreKeys: oneTimePreKeys.length,
  };
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

  const devices = await models.UserDevice.findAll({
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

  return devices.filter((device: any) => hasValidSecureBundleShape(device));
};
