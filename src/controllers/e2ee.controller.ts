import { NextFunction, Response } from "express";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import {
  getUserDeviceBundles,
  listUserDevices,
  revokeUserDevice,
  upsertUserDeviceBundle,
} from "../services/e2eeDevice.service";
import {
  createOrGetSecureDMChat,
  getSecureDMMessagePage,
  markSecureChatMessagesAsRead,
  sendSecureDMMessage,
} from "../services/e2eeMessage.service";
import { notifyChatMessageReceived } from "../utils/notificationHelpers";
import { uploadEncryptedChatMedia } from "../services/mediaUploadService";
import fs from "fs";

const ensureAuthenticatedUser = async (
  req: AuthenticatedRequest,
  models: ReturnType<typeof Models>,
) => {
  const userId = req.user?.id;
  if (!userId) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  const user = await models.User.findByPk(userId);
  if (!user) {
    throw Object.assign(
      new Error("Secure chat device registration is supported for user accounts only"),
      { statusCode: 403 },
    );
  }

  return userId;
};

export const registerSecureDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const result = await upsertUserDeviceBundle(models, userId, req.body);

    return res.status(200).json({
      success: true,
      message: "Secure device bundle registered",
      data: {
        id: result.device.id,
        deviceId: result.device.deviceId,
        deviceName: result.device.deviceName,
        platform: result.device.platform,
        appVersion: result.device.appVersion,
        availableOneTimePreKeys: result.availableOneTimePreKeys,
        uploadedAt: result.bundle.uploadedAt,
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const getMySecureDevices = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const devices = await listUserDevices(models, userId);

    return res.status(200).json({
      success: true,
      data: devices.map((device: any) => ({
        id: device.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        appVersion: device.appVersion,
        isActive: device.isActive,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt,
        bundle: device.keyBundle
          ? {
              algorithm: device.keyBundle.algorithm,
              registrationId: device.keyBundle.registrationId,
              signedPreKeyId: device.keyBundle.signedPreKeyId,
              uploadedAt: device.keyBundle.uploadedAt,
            }
          : null,
        availableOneTimePreKeys: Array.isArray(device.oneTimePreKeys)
          ? device.oneTimePreKeys.length
          : 0,
      })),
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const revokeMySecureDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const result = await revokeUserDevice(models, userId, req.params.deviceId);

    return res.status(200).json({
      success: true,
      message: "Secure device revoked",
      data: result,
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const getPublicDeviceBundlesForUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const requesterId = await ensureAuthenticatedUser(req, models);
    const targetUserId = req.params.userId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Target userId is required",
      });
    }

    const devices = await getUserDeviceBundles(models, requesterId, targetUserId);

    return res.status(200).json({
      success: true,
      data: devices.map((device: any) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        bundle: device.keyBundle
          ? {
              algorithm: device.keyBundle.algorithm,
              identityPublicKey: device.keyBundle.identityPublicKey,
              signedPreKeyId: device.keyBundle.signedPreKeyId,
              signedPreKeyPublic: device.keyBundle.signedPreKeyPublic,
              signedPreKeySignature: device.keyBundle.signedPreKeySignature,
              registrationId: device.keyBundle.registrationId,
            }
          : null,
        oneTimePreKeys: Array.isArray(device.oneTimePreKeys)
          ? device.oneTimePreKeys.map((preKey: any) => ({
              keyId: preKey.preKeyId,
              publicKey: preKey.publicKey,
            }))
          : [],
      })),
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const createOrGetSecureDM = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const { participantId } = req.body || {};

    const result = await createOrGetSecureDMChat(models, {
      userId,
      participantId,
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created
        ? "Secure chat created successfully"
        : "Existing secure chat found",
      data: {
        chatId: result.chat.id,
        securityMode: result.chat.securityMode,
        protocolVersion: result.chat.protocolVersion,
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

const resolveSecureDeviceId = (req: AuthenticatedRequest) =>
  req.header("x-qc-device-id")?.trim() || req.body?.senderDeviceId?.trim() || "";

export const getSecureChatMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const { chatId } = req.params;
    const deviceId = resolveSecureDeviceId(req);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "chatId is required",
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "x-qc-device-id is required for secure chat access",
      });
    }

    const result = await getSecureDMMessagePage(models, {
      chatId,
      userId,
      deviceId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        messages: result.rows.map((message: any) => ({
          id: message.id,
          chatId: message.chatId,
          content: "",
          encryptedEnvelope: message.encryptedEnvelope,
          messageType: message.messageType,
          replyToMessageId: message.replyToMessageId,
          status: message.status,
          deliveredAt: message.deliveredAt,
          readAt: message.readAt,
          createdAt: message.createdAt,
          sender: {
            id: message.senderId,
            name: message.sender
              ? `${message.sender.firstName || ""} ${message.sender.lastName || ""}`.trim() ||
                "Unknown"
              : "Unknown",
            firstName: message.sender?.firstName,
            lastName: message.sender?.lastName,
            avatar: message.sender?.profile?.profileImage,
          },
        })),
        pagination: {
          page,
          limit,
          total: result.count,
          totalPages: Math.ceil(result.count / limit),
        },
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const sendSecureChatMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const { chatId } = req.params;
    const deviceId = resolveSecureDeviceId(req);
    const { messageType = "text", replyToMessageId, recipientPayloads } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "chatId is required",
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "x-qc-device-id is required for secure message sending",
      });
    }

    const message = await sendSecureDMMessage(models, {
      chatId,
      userId,
      senderDeviceId: deviceId,
      messageType,
      replyToMessageId,
      recipientPayloads,
    });

    const io = req.app.get("io");
    const app = req.app;
    const senderPayload = {
      id: message.senderId,
      name: message.get("sender")
        ? `${(message.get("sender") as any).firstName || ""} ${
            (message.get("sender") as any).lastName || ""
          }`.trim() || "Unknown"
        : "Unknown",
      firstName: (message.get("sender") as any)?.firstName,
      lastName: (message.get("sender") as any)?.lastName,
      avatar: (message.get("sender") as any)?.profile?.profileImage,
    };

    const participants = await models.ChatParticipant.findAll({
      where: { chatId },
      attributes: ["userId"],
    });

    for (const participant of participants) {
      io.to(`user_${participant.userId}`).emit("secure_message_available", {
        chatId,
        messageId: message.id,
        senderId: message.senderId,
        sender: senderPayload,
        messageType: message.messageType,
        replyToMessageId: message.replyToMessageId || null,
        securityMode: "secure_dm_v1",
        createdAt: message.createdAt,
      });

      if (participant.userId !== userId) {
        await notifyChatMessageReceived(
          app,
          participant.userId,
          chatId,
          message.id,
          senderPayload.id,
          senderPayload.name,
          "Secure message",
          "secure",
          false,
        );
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        id: message.id,
        chatId: message.chatId,
        messageType: message.messageType,
        replyToMessageId: message.replyToMessageId,
        status: message.status,
        createdAt: message.createdAt,
        sender: senderPayload,
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const uploadSecureChatMedia = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const { chatId } = req.params;
    const deviceId = resolveSecureDeviceId(req);
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required" });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "x-qc-device-id is required for secure media upload",
      });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: "Encrypted file is required" });
    }

    await getSecureDMMessagePage(models, {
      chatId,
      userId,
      deviceId,
      page: 1,
      limit: 1,
    });

    const uploadResult = await uploadEncryptedChatMedia(file);

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    if (!uploadResult.success || !uploadResult.data) {
      return res.status(400).json({
        success: false,
        message: uploadResult.error || "Failed to upload encrypted media",
      });
    }

    return res.status(201).json({
      success: true,
      data: uploadResult.data,
    });
  } catch (error: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

export const markSecureChatAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = await ensureAuthenticatedUser(req, models);
    const { chatId } = req.params;
    const deviceId = resolveSecureDeviceId(req);

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "chatId is required",
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "x-qc-device-id is required for secure read sync",
      });
    }

    const readAt = await markSecureChatMessagesAsRead(models, {
      chatId,
      userId,
      deviceId,
    });

    const io = req.app.get("io");
    io.to(`chat_${chatId}`).emit("messages_read", {
      chatId,
      readBy: userId,
      readAt,
    });

    return res.status(200).json({
      success: true,
      data: { readAt },
      message: "Secure messages marked as read",
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};
