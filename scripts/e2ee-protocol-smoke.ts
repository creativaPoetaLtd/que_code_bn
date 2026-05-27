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

const buildEnvelope = (
  recipientUserId: string,
  recipientDeviceId: string,
  recipientOneTimePreKeyId?: number,
) => ({
  version: 1,
  protocolVersion: "secure-dm-v1",
  algorithm: "qc-e2ee-p256-v1",
  senderUserId: "user-a",
  senderDeviceId: "device-a-1",
  recipientUserId,
  recipientDeviceId,
  recipientOneTimePreKeyId,
  ephemeralPublicKey: p256PublicKey("e"),
  wrappedMessageKey: "wrapped",
  wrappedMessageKeyIv: "wrapped-iv",
  ciphertext: "ciphertext",
  ciphertextIv: "ciphertext-iv",
  createdAt: new Date().toISOString(),
  signature: "signature",
});

const buildRecipientPayload = (
  recipientUserId: string,
  recipientDeviceId: string,
  recipientOneTimePreKeyId?: number,
) => ({
  recipientUserId,
  recipientDeviceId,
  encryptedEnvelope: buildEnvelope(recipientUserId, recipientDeviceId, recipientOneTimePreKeyId),
});

const buildSendModels = ({
  consumeCount = 1,
}: {
  consumeCount?: number;
} = {}) => {
  const createdPayloadRows: unknown[] = [];
  const consumedPreKeys: unknown[] = [];
  const createdMessage = {
    id: "message-1",
    chatId: "chat-1",
    senderId: "user-a",
    messageType: "text",
    replyToMessageId: null,
    status: "sent",
    createdAt: new Date(),
  };

  return {
    createdPayloadRows,
    consumedPreKeys,
    models: {
      ChatParticipant: {
        findOne: async () => ({ chatId: "chat-1", userId: "user-a" }),
        findAll: async () => [{ userId: "user-a" }, { userId: "user-b" }],
      },
      Chat: {
        findByPk: async () => ({
          id: "chat-1",
          isGroup: false,
          type: "dm",
          securityMode: "secure_dm_v1",
        }),
      },
      UserDevice: {
        findOne: async ({ where }: any) =>
          where.userId === "user-a" && where.deviceId === "device-a-1"
            ? {
                id: "device-row-a1",
                userId: "user-a",
                deviceId: "device-a-1",
                keyBundle: {},
              }
            : null,
        findAll: async () => [
          {
            id: "device-row-a1",
            userId: "user-a",
            deviceId: "device-a-1",
            keyBundle: {},
            oneTimePreKeys: [{ preKeyId: 201 }],
          },
          {
            id: "device-row-b1",
            userId: "user-b",
            deviceId: "device-b-1",
            keyBundle: {},
            oneTimePreKeys: [{ preKeyId: 301 }],
          },
          {
            id: "device-row-b2",
            userId: "user-b",
            deviceId: "device-b-2",
            keyBundle: {},
            oneTimePreKeys: [{ preKeyId: 302 }],
          },
        ],
        update: async () => [1],
      },
      ChatMessage: {
        create: async () => createdMessage,
        findOne: async () => null,
        findByPk: async () => createdMessage,
      },
      ChatMessageRecipientPayload: {
        bulkCreate: async (rows: unknown[]) => {
          createdPayloadRows.push(...rows);
        },
      },
      DeviceOneTimePreKey: {
        update: async (_values: unknown, options: unknown) => {
          consumedPreKeys.push(options);
          return [consumeCount];
        },
      },
    },
  };
};

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

  process.env.DB_DEV_URL ||= "postgres://user:pass@localhost:5432/qc_smoke";
  const { sequelizeConnection } = await import("../src/database/config/db.config");
  const { sendSecureDMMessage } = await import("../src/services/e2eeMessage.service");

  (sequelizeConnection as any).transaction = async (callback: (transaction: unknown) => unknown) =>
    callback({ smoke: true });

  const sendSuccess = buildSendModels();
  const sentMessage = await sendSecureDMMessage(sendSuccess.models, {
    chatId: "chat-1",
    userId: "user-a",
    senderDeviceId: "device-a-1",
    messageType: "text",
    recipientPayloads: [
      buildRecipientPayload("user-a", "device-a-1", 201),
      buildRecipientPayload("user-b", "device-b-1", 301),
      buildRecipientPayload("user-b", "device-b-2", 302),
    ],
  });

  assert.equal((sentMessage as any).id, "message-1");
  assert.equal(sendSuccess.createdPayloadRows.length, 3);
  assert.equal(sendSuccess.consumedPreKeys.length, 3);

  const sendMediaSuccess = buildSendModels();
  await sendSecureDMMessage(sendMediaSuccess.models, {
    chatId: "chat-1",
    userId: "user-a",
    senderDeviceId: "device-a-1",
    messageType: "image",
    recipientPayloads: [buildRecipientPayload("user-b", "device-b-1", 301)],
  });

  assert.equal(sendMediaSuccess.createdPayloadRows.length, 1);
  assert.equal(sendMediaSuccess.consumedPreKeys.length, 1);

  await expectStatus(
    () =>
      sendSecureDMMessage(buildSendModels().models, {
        chatId: "chat-1",
        userId: "user-a",
        senderDeviceId: "device-a-1",
        messageType: "money" as any,
        recipientPayloads: [buildRecipientPayload("user-b", "device-b-1", 301)],
      }),
    400,
    "Unsupported secure message type",
  );

  await expectStatus(
    () =>
      sendSecureDMMessage(buildSendModels().models, {
        chatId: "chat-1",
        userId: "user-a",
        senderDeviceId: "device-a-1",
        messageType: "text",
        recipientPayloads: [buildRecipientPayload("user-c", "device-c-1", 401)],
      }),
    400,
    "outside this secure chat",
  );

  await expectStatus(
    () =>
      sendSecureDMMessage(buildSendModels({ consumeCount: 0 }).models, {
        chatId: "chat-1",
        userId: "user-a",
        senderDeviceId: "device-a-1",
        messageType: "text",
        recipientPayloads: [buildRecipientPayload("user-b", "device-b-1", 301)],
      }),
    409,
    "already consumed",
  );

  console.log("E2EE protocol smoke checks passed");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
