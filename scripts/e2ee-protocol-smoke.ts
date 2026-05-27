import assert from "node:assert/strict";
import {
  getUserDeviceBundles,
  revokeUserDevice,
  upsertUserDeviceBundle,
} from "../src/services/e2eeDevice.service";

const p256PublicKey = (seed: string) => ({
  kty: "EC",
  crv: "P-256",
  x: Buffer.alloc(32, `${seed}x`).toString("base64url"),
  y: Buffer.alloc(32, `${seed}y`).toString("base64url"),
});

const validBundle = {
  deviceId: "device-secure-smoke-1",
  deviceName: "Smoke Browser",
  platform: "test",
  appVersion: "test",
  bundle: {
    algorithm: "qc-e2ee-p256-v1",
    identityPublicKey: p256PublicKey("i"),
    signedPreKey: {
      keyId: 11,
      publicKey: p256PublicKey("s"),
      signature: Buffer.alloc(64, "signature").toString("base64url"),
    },
    registrationId: 42,
    oneTimePreKeys: [
      { keyId: 101, publicKey: p256PublicKey("a") },
      { keyId: 102, publicKey: p256PublicKey("b") },
    ],
  },
};

const expectStatus = async (
  run: () => Promise<unknown>,
  statusCode: number,
  messageIncludes: string,
) => {
  await assert.rejects(run, (error: any) => {
    assert.equal(error.statusCode, statusCode);
    assert.match(error.message, new RegExp(messageIncludes));
    return true;
  });
};

const buildDevice = (overrides: Record<string, unknown> = {}) => ({
  id: "user-device-row-id",
  userId: "user-a",
  deviceId: validBundle.deviceId,
  deviceName: null,
  platform: null,
  appVersion: null,
  isActive: true,
  revokedAt: null,
  lastSeenAt: null,
  keyBundle: {
    identityPublicKey: validBundle.bundle.identityPublicKey,
    signedPreKeyPublic: validBundle.bundle.signedPreKey.publicKey,
    signedPreKeySignature: validBundle.bundle.signedPreKey.signature,
  },
  async update(values: Record<string, unknown>) {
    Object.assign(this, values);
    return this;
  },
  ...overrides,
});

const buildBundle = () => ({
  uploadedAt: null,
  async update(values: Record<string, unknown>) {
    Object.assign(this, values);
    return this;
  },
});

const run = async () => {
  await expectStatus(
    () =>
      upsertUserDeviceBundle({} as any, "user-a", {
        ...validBundle,
        bundle: {
          ...validBundle.bundle,
          algorithm: "unsupported",
        },
      }),
    400,
    "Unsupported E2EE algorithm",
  );

  let destroyedPreKeysWhere: unknown = null;
  let insertedPreKeys: unknown[] = [];
  const upsertDevice = buildDevice();
  const upsertBundle = buildBundle();
  const upsertModels = {
    UserDevice: {
      findOne: async () => null,
      findOrCreate: async () => [upsertDevice],
    },
    DeviceKeyBundle: {
      findOrCreate: async () => [upsertBundle],
    },
    DeviceOneTimePreKey: {
      destroy: async ({ where }: { where: unknown }) => {
        destroyedPreKeysWhere = where;
      },
      bulkCreate: async (rows: unknown[]) => {
        insertedPreKeys = rows;
      },
    },
  };

  const registered = await upsertUserDeviceBundle(upsertModels, "user-a", validBundle);
  assert.equal(registered.availableOneTimePreKeys, 2);
  assert.equal(upsertDevice.userId, "user-a");
  assert.equal((upsertBundle as any).algorithm, "qc-e2ee-p256-v1");
  assert.deepEqual(destroyedPreKeysWhere, {
    userDeviceId: "user-device-row-id",
    usedAt: null,
  });
  assert.equal(insertedPreKeys.length, 2);

  await expectStatus(
    () =>
      getUserDeviceBundles(
        {
          Contact: { findOne: async () => null },
        } as any,
        "user-a",
        "user-b",
      ),
    403,
    "active contacts",
  );

  let revokeDestroyWhere: unknown = null;
  const revokedDevice = buildDevice();
  const revokeModels = {
    UserDevice: {
      findOne: async () => revokedDevice,
    },
    DeviceOneTimePreKey: {
      destroy: async ({ where }: { where: unknown }) => {
        revokeDestroyWhere = where;
      },
    },
  };

  const revoked = await revokeUserDevice(revokeModels, "user-a", validBundle.deviceId);
  assert.equal(revoked.deviceId, validBundle.deviceId);
  assert.equal(revokedDevice.isActive, false);
  assert.ok(revokedDevice.revokedAt instanceof Date);
  assert.deepEqual(revokeDestroyWhere, {
    userDeviceId: "user-device-row-id",
    usedAt: null,
  });

  console.log("E2EE protocol smoke checks passed");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
