import { Op } from "sequelize";
import { sequelizeConnection } from "../database/config/db.config";

const SECURE_DM_PROTOCOL_VERSION = "secure-dm-v1";
const SECURE_MESSAGE_PLACEHOLDER = "Secure message";

type SecureRecipientPayloadInput = {
  recipientUserId: string;
  recipientDeviceId: string;
  encryptedEnvelope: Record<string, any>;
};

type SecureMessageType = "text" | "image" | "file" | "audio" | "video" | "document";
type SecureEnvelopeInput = Record<string, any>;

const assertSecureUserDevice = async (
  models: any,
  userId: string,
  deviceId: string,
) => {
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
      {
        model: models.DeviceOneTimePreKey,
        as: "oneTimePreKeys",
        required: false,
        where: { usedAt: null },
      },
    ],
  });

  if (!device) {
    throw Object.assign(new Error("A registered secure device is required"), {
      statusCode: 400,
    });
  }

  return device;
};

const assertSecureChatParticipant = async (
  models: any,
  chatId: string,
  userId: string,
) => {
  const participant = await models.ChatParticipant.findOne({
    where: { chatId, userId },
  });

  if (!participant) {
    throw Object.assign(new Error("You are not authorized for this chat"), {
      statusCode: 403,
    });
  }

  const chat = await models.Chat.findByPk(chatId);
  if (!chat) {
    throw Object.assign(new Error("Chat not found"), { statusCode: 404 });
  }

  if (chat.securityMode !== "secure_dm_v1") {
    throw Object.assign(
      new Error("This chat is not using secure_dm_v1"),
      { statusCode: 400 },
    );
  }

  if (chat.isGroup || chat.type === "support") {
    throw Object.assign(
      new Error("secure_dm_v1 currently supports direct messages only"),
      { statusCode: 400 },
    );
  }

  return chat;
};

export const supportsSecureDmBetweenUsers = async (
  models: any,
  userIds: string[],
) => {
  const rows = await models.UserDevice.findAll({
    where: {
      userId: { [Op.in]: userIds },
      isActive: true,
      revokedAt: null,
    },
    attributes: ["userId"],
    include: [
      {
        model: models.DeviceKeyBundle,
        as: "keyBundle",
        required: true,
        attributes: ["id"],
      },
    ],
  });

  const capableUserIds = new Set(rows.map((row: any) => row.userId));
  return userIds.every((userId) => capableUserIds.has(userId));
};

export const createOrGetSecureDMChat = async (
  models: any,
  {
    userId,
    participantId,
  }: {
    userId: string;
    participantId: string;
  },
) => {
  if (!participantId) {
    throw Object.assign(new Error("Participant ID is required"), {
      statusCode: 400,
    });
  }

  if (participantId === userId) {
    throw Object.assign(new Error("Cannot create a secure chat with yourself"), {
      statusCode: 400,
    });
  }

  const otherUser = await models.User.findByPk(participantId, {
    attributes: ["id"],
  });

  if (!otherUser) {
    throw Object.assign(new Error("User not found"), {
      statusCode: 404,
    });
  }

  const contactRelation = await models.Contact.findOne({
    where: {
      [Op.or]: [
        { userAId: userId, userBId: participantId },
        { userAId: participantId, userBId: userId },
      ],
      status: "active",
    },
  });

  if (!contactRelation) {
    throw Object.assign(
      new Error("You can only start secure chats with your contacts"),
      {
        statusCode: 403,
      },
    );
  }

  const canUseSecureDm = await supportsSecureDmBetweenUsers(models, [
    userId,
    participantId,
  ]);

  if (!canUseSecureDm) {
    throw Object.assign(
      new Error("Both users need at least one registered secure device"),
      {
        statusCode: 400,
      },
    );
  }

  const userChats = await models.ChatParticipant.findAll({
    where: { userId },
    attributes: ["chatId"],
    include: [
      {
        model: models.Chat,
        as: "chat",
        where: {
          isGroup: false,
          securityMode: "secure_dm_v1",
        },
      },
    ],
  });

  const participantChats = await models.ChatParticipant.findAll({
    where: { userId: participantId },
    attributes: ["chatId"],
    include: [
      {
        model: models.Chat,
        as: "chat",
        where: {
          isGroup: false,
          securityMode: "secure_dm_v1",
        },
      },
    ],
  });

  const userChatIds = new Set(userChats.map((row: any) => row.chatId));
  const commonChatIds = participantChats
    .map((row: any) => row.chatId)
    .filter((chatId: string) => userChatIds.has(chatId));

  for (const chatId of commonChatIds) {
    const participantCount = await models.ChatParticipant.count({
      where: { chatId },
    });

    if (participantCount !== 2) {
      continue;
    }

    const existingChat = await models.Chat.findByPk(chatId);
    if (existingChat?.securityMode === "secure_dm_v1") {
      return {
        chat: existingChat,
        created: false,
      };
    }
  }

  const newChat = await sequelizeConnection.transaction(async (transaction) => {
    const chat = await models.Chat.create(
      {
        isGroup: false,
        securityMode: "secure_dm_v1",
        protocolVersion: SECURE_DM_PROTOCOL_VERSION,
      },
      { transaction },
    );

    await models.ChatParticipant.bulkCreate(
      [
        {
          chatId: chat.id,
          userId,
          joinedAt: new Date(),
        },
        {
          chatId: chat.id,
          userId: participantId,
          joinedAt: new Date(),
        },
      ],
      { transaction },
    );

    return chat;
  });

  return {
    chat: newChat,
    created: true,
  };
};

const listSecureDevicesForChat = async (models: any, chatId: string) => {
  const participants = await models.ChatParticipant.findAll({
    where: { chatId },
    attributes: ["userId"],
  });

  const participantUserIds = participants.map((participant: any) => participant.userId);
  const devices = await models.UserDevice.findAll({
    where: {
      userId: { [Op.in]: participantUserIds },
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
  });

  return {
    participantUserIds,
    devices,
  };
};

const assertValidSecureEnvelope = ({
  envelope,
  senderUserId,
  senderDeviceId,
  recipientUserId,
  recipientDeviceId,
}: {
  envelope: SecureEnvelopeInput;
  senderUserId: string;
  senderDeviceId: string;
  recipientUserId: string;
  recipientDeviceId: string;
}) => {
  const requiredStringFields = [
    "protocolVersion",
    "algorithm",
    "senderUserId",
    "senderDeviceId",
    "recipientUserId",
    "recipientDeviceId",
    "wrappedMessageKey",
    "wrappedMessageKeyIv",
    "ciphertext",
    "ciphertextIv",
    "createdAt",
    "signature",
  ];

  if (envelope.version !== 1) {
    throw Object.assign(new Error("Unsupported secure envelope version"), { statusCode: 400 });
  }

  for (const field of requiredStringFields) {
    if (typeof envelope[field] !== "string" || envelope[field].length === 0) {
      throw Object.assign(new Error("Malformed secure envelope submitted"), { statusCode: 400 });
    }
  }

  if (
    envelope.protocolVersion !== SECURE_DM_PROTOCOL_VERSION ||
    envelope.algorithm !== "qc-e2ee-p256-v1"
  ) {
    throw Object.assign(new Error("Unsupported secure envelope protocol"), { statusCode: 400 });
  }

  if (envelope.senderUserId !== senderUserId || envelope.senderDeviceId !== senderDeviceId) {
    throw Object.assign(new Error("Secure envelope sender identity does not match request"), {
      statusCode: 400,
    });
  }

  if (
    envelope.recipientUserId !== recipientUserId ||
    envelope.recipientDeviceId !== recipientDeviceId
  ) {
    throw Object.assign(new Error("Secure envelope recipient identity does not match payload"), {
      statusCode: 400,
    });
  }

  if (!envelope.ephemeralPublicKey || typeof envelope.ephemeralPublicKey !== "object") {
    throw Object.assign(new Error("Malformed secure envelope submitted"), { statusCode: 400 });
  }

  if (
    envelope.recipientOneTimePreKeyId !== undefined &&
    envelope.recipientOneTimePreKeyId !== null &&
    !Number.isInteger(envelope.recipientOneTimePreKeyId)
  ) {
    throw Object.assign(new Error("Invalid one-time pre-key metadata"), { statusCode: 400 });
  }
};

export const sendSecureDMMessage = async (
  models: any,
  {
    chatId,
    userId,
    senderDeviceId,
    messageType,
    replyToMessageId,
    recipientPayloads,
  }: {
    chatId: string;
    userId: string;
    senderDeviceId: string;
    messageType: SecureMessageType;
    replyToMessageId?: string | null;
    recipientPayloads: SecureRecipientPayloadInput[];
  },
) => {
  if (!["text", "image", "file", "audio", "video", "document"].includes(messageType)) {
    throw Object.assign(
      new Error("Unsupported secure message type"),
      { statusCode: 400 },
    );
  }

  if (!Array.isArray(recipientPayloads) || recipientPayloads.length === 0) {
    throw Object.assign(new Error("At least one encrypted payload is required"), {
      statusCode: 400,
    });
  }

  await assertSecureChatParticipant(models, chatId, userId);
  await assertSecureUserDevice(models, userId, senderDeviceId);

  const { participantUserIds, devices } = await listSecureDevicesForChat(models, chatId);
  const allowedDevicePairs = new Map<string, any>();

  for (const device of devices) {
    allowedDevicePairs.set(`${device.userId}:${device.deviceId}`, device);
  }

  const uniquePairs = new Set<string>();
  const oneTimePreKeyUsages: Array<{ userDeviceId: string; preKeyId: number }> = [];
  let containsOtherParticipantPayload = false;

  for (const payload of recipientPayloads) {
    if (
      !payload?.recipientUserId ||
      !payload?.recipientDeviceId ||
      !payload?.encryptedEnvelope ||
      typeof payload.encryptedEnvelope !== "object"
    ) {
      throw Object.assign(new Error("Malformed encrypted payload submitted"), {
        statusCode: 400,
      });
    }

    assertValidSecureEnvelope({
      envelope: payload.encryptedEnvelope,
      senderUserId: userId,
      senderDeviceId,
      recipientUserId: payload.recipientUserId,
      recipientDeviceId: payload.recipientDeviceId,
    });

    const pairKey = `${payload.recipientUserId}:${payload.recipientDeviceId}`;
    const targetDevice = allowedDevicePairs.get(pairKey);
    if (!targetDevice) {
      throw Object.assign(
        new Error("Encrypted payload targets a device outside this secure chat"),
        { statusCode: 400 },
      );
    }

    if (uniquePairs.has(pairKey)) {
      throw Object.assign(
        new Error("Duplicate encrypted payload submitted for the same device"),
        { statusCode: 400 },
      );
    }

    uniquePairs.add(pairKey);

    const recipientOneTimePreKeyId = payload.encryptedEnvelope.recipientOneTimePreKeyId;
    if (recipientOneTimePreKeyId !== undefined && recipientOneTimePreKeyId !== null) {
      if (!Number.isInteger(recipientOneTimePreKeyId)) {
        throw Object.assign(new Error("Invalid one-time pre-key metadata"), {
          statusCode: 400,
        });
      }

      const availableOneTimePreKeys = Array.isArray(targetDevice.oneTimePreKeys)
        ? targetDevice.oneTimePreKeys
        : [];
      const matchingPreKey = availableOneTimePreKeys.find(
        (preKey: any) => preKey.preKeyId === recipientOneTimePreKeyId,
      );

      if (!matchingPreKey) {
        throw Object.assign(
          new Error("Encrypted payload references an unavailable one-time pre-key"),
          { statusCode: 400 },
        );
      }

      oneTimePreKeyUsages.push({
        userDeviceId: targetDevice.id,
        preKeyId: recipientOneTimePreKeyId,
      });
    }

    if (payload.recipientUserId !== userId) {
      containsOtherParticipantPayload = true;
    }
  }

  if (!containsOtherParticipantPayload) {
    throw Object.assign(
      new Error("At least one recipient payload for the other participant is required"),
      { statusCode: 400 },
    );
  }

  if (replyToMessageId) {
    const replyTarget = await models.ChatMessage.findOne({
      where: {
        id: replyToMessageId,
        chatId,
      },
      attributes: ["id"],
    });

    if (!replyTarget) {
      throw Object.assign(new Error("Reply target not found in this chat"), {
        statusCode: 400,
      });
    }
  }

  const createdMessage = await sequelizeConnection.transaction(async (transaction) => {
    const message = await models.ChatMessage.create(
      {
        chatId,
        senderId: userId,
        content: SECURE_MESSAGE_PLACEHOLDER,
        messageType,
        replyToMessageId: replyToMessageId || null,
        isEncrypted: true,
        encryptionIv: null,
        status: "sent",
      },
      { transaction },
    );

    await models.ChatMessageRecipientPayload.bulkCreate(
      recipientPayloads.map((payload) => ({
        chatMessageId: message.id,
        recipientUserId: payload.recipientUserId,
        recipientDeviceId: payload.recipientDeviceId,
        senderDeviceId,
        encryptedEnvelope: payload.encryptedEnvelope,
        deliveredAt: payload.recipientUserId === userId ? new Date() : null,
        readAt: payload.recipientUserId === userId ? new Date() : null,
      })),
      { transaction },
    );

    if (oneTimePreKeyUsages.length > 0) {
      const usedAt = new Date();
      const usageResults = await Promise.all(
        oneTimePreKeyUsages.map((usage) =>
          models.DeviceOneTimePreKey.update(
            { usedAt },
            {
              where: {
                userDeviceId: usage.userDeviceId,
                preKeyId: usage.preKeyId,
                usedAt: null,
              },
              transaction,
            },
          ),
        ),
      );

      const consumedCount = usageResults.reduce((total: number, result: any) => {
        const count = Array.isArray(result) ? Number(result[0]) : Number(result);
        return total + (Number.isFinite(count) ? count : 0);
      }, 0);

      if (consumedCount !== oneTimePreKeyUsages.length) {
        throw Object.assign(
          new Error("One-time pre-key was already consumed. Refresh recipient devices and retry."),
          { statusCode: 409 },
        );
      }
    }

    await models.UserDevice.update(
      { lastSeenAt: new Date() },
      {
        where: {
          userId,
          deviceId: senderDeviceId,
        },
        transaction,
      },
    );

    return message;
  });

  return models.ChatMessage.findByPk(createdMessage.id, {
    include: [
      {
        model: models.User,
        as: "sender",
        attributes: ["id", "firstName", "lastName"],
        include: [
          {
            model: models.Profile,
            as: "profile",
            attributes: ["profileImage"],
          },
        ],
      },
    ],
  });
};

export const getSecureDMMessagePage = async (
  models: any,
  {
    chatId,
    userId,
    deviceId,
    page,
    limit,
  }: {
    chatId: string;
    userId: string;
    deviceId: string;
    page: number;
    limit: number;
  },
) => {
  await assertSecureChatParticipant(models, chatId, userId);
  await assertSecureUserDevice(models, userId, deviceId);

  const result = await models.ChatMessage.findAndCountAll({
    where: { chatId },
    include: [
      {
        model: models.User,
        as: "sender",
        attributes: ["id", "firstName", "lastName"],
        include: [
          {
            model: models.Profile,
            as: "profile",
            attributes: ["profileImage"],
          },
        ],
      },
      {
        model: models.ChatMessageRecipientPayload,
        as: "recipientPayloads",
        required: true,
        where: {
          recipientUserId: userId,
          recipientDeviceId: deviceId,
        },
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const justDeliveredIds = result.rows
    .filter((message: any) => {
      const payload = Array.isArray(message.recipientPayloads)
        ? message.recipientPayloads[0]
        : null;
      return payload && message.senderId !== userId && !payload.deliveredAt;
    })
    .map((message: any) => message.id);

  const now = new Date();
  const deliveredEvents = result.rows
    .filter((message: any) => justDeliveredIds.includes(message.id))
    .map((message: any) => ({
      chatId: message.chatId,
      messageId: message.id,
      senderId: message.senderId,
      deliveredAt: now,
    }));

  if (justDeliveredIds.length > 0) {
    await models.ChatMessageRecipientPayload.update(
      { deliveredAt: now },
      {
        where: {
          chatMessageId: { [Op.in]: justDeliveredIds },
          recipientUserId: userId,
          recipientDeviceId: deviceId,
          deliveredAt: null,
        },
      },
    );
    await models.ChatMessage.update(
      { status: "delivered", deliveredAt: now },
      {
        where: {
          id: { [Op.in]: justDeliveredIds },
          senderId: { [Op.ne]: userId },
          status: "sent",
        },
      },
    );
  }

  const messageIds = result.rows.map((message: any) => message.id);
  const receiptPayloads = messageIds.length > 0
    ? await models.ChatMessageRecipientPayload.findAll({
        where: {
          chatMessageId: { [Op.in]: messageIds },
        },
      })
    : [];
  const receiptsByMessageId = new Map<string, any[]>();
  for (const receipt of receiptPayloads) {
    const existing = receiptsByMessageId.get(receipt.chatMessageId) || [];
    existing.push(receipt);
    receiptsByMessageId.set(receipt.chatMessageId, existing);
  }

  return {
    count: typeof result.count === "number" ? result.count : result.count.length,
    deliveredEvents,
    rows: result.rows.map((message: any) => {
      const payload = Array.isArray(message.recipientPayloads)
        ? message.recipientPayloads[0]
        : null;
      const messageReceipts = receiptsByMessageId.get(message.id) || [];
      const otherUserReceipts = messageReceipts.filter(
        (receipt) => receipt.recipientUserId !== message.senderId,
      );
      const deliveredAt =
        otherUserReceipts.find((receipt) => receipt.deliveredAt)?.deliveredAt ||
        null;
      const readReceipts = otherUserReceipts
        .filter((receipt) => receipt.readAt)
        .map((receipt) => ({
          userId: receipt.recipientUserId,
          readAt: receipt.readAt,
        }));
      const readAt = readReceipts[0]?.readAt || null;

      return {
        id: message.id,
        chatId: message.chatId,
        messageType: message.messageType,
        replyToMessageId: message.replyToMessageId,
        status: readAt ? "read" : deliveredAt ? "delivered" : message.status,
        deliveredAt,
        readAt,
        readBy: readReceipts,
        createdAt: message.createdAt,
        senderId: message.senderId,
        sender: message.sender,
        encryptedEnvelope: payload?.encryptedEnvelope || null,
      };
    }),
  };
};

export const markSecureChatMessagesAsRead = async (
  models: any,
  {
    chatId,
    userId,
    deviceId,
  }: {
    chatId: string;
    userId: string;
    deviceId: string;
  },
) => {
  await assertSecureChatParticipant(models, chatId, userId);
  await assertSecureUserDevice(models, userId, deviceId);

  const now = new Date();
  const unreadMessages = await models.ChatMessage.findAll({
    where: {
      chatId,
      senderId: { [Op.ne]: userId },
    },
    attributes: ["id"],
  });

  const unreadMessageIds = unreadMessages.map((message: any) => message.id);

  await sequelizeConnection.transaction(async (transaction) => {
    await models.ChatParticipant.update(
      { lastReadAt: now },
      {
        where: { chatId, userId },
        transaction,
      },
    );

    if (unreadMessageIds.length > 0) {
      await models.ChatMessageRecipientPayload.update(
        {
          deliveredAt: now,
          readAt: now,
        },
        {
          where: {
            chatMessageId: { [Op.in]: unreadMessageIds },
            recipientUserId: userId,
            recipientDeviceId: deviceId,
          },
          transaction,
        },
      );

      await models.ChatMessage.update(
        {
          status: "read",
          deliveredAt: now,
          readAt: now,
        },
        {
          where: {
            id: { [Op.in]: unreadMessageIds },
            senderId: { [Op.ne]: userId },
          },
          transaction,
        },
      );
    }

    await models.UserDevice.update(
      { lastSeenAt: now },
      {
        where: {
          userId,
          deviceId,
        },
        transaction,
      },
    );
  });

  return now;
};

export { SECURE_DM_PROTOCOL_VERSION, SECURE_MESSAGE_PLACEHOLDER };
