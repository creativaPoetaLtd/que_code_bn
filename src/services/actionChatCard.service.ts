import { Application } from "express";
import database_models from "../database/config/db.config";

const { ChatMessage, ChatParticipant, User, Profile } = database_models;

/**
 * Write an action card (a transferred ticket, or a shared action) into a chat as a
 * plain, unencrypted message.
 *
 * Secure DMs keep their text end-to-end encrypted, so a card composed by the client
 * would only ever be readable on the sending device. Money and escrow cards already
 * sidestep that by being written here, server-side, as unencrypted rows -
 * getSecureDMMessagePage passes those straight through without a decryption step.
 * Action cards take the same route.
 */
export const postActionCardMessage = async (
  app: Application,
  {
    chatId,
    senderId,
    payload,
  }: {
    chatId: string;
    senderId: string;
    payload: Record<string, any>;
  },
) => {
  const participants = await ChatParticipant.findAll({
    where: { chatId },
    attributes: ["userId"],
  });

  if (participants.length === 0) {
    throw Object.assign(new Error("Chat not found"), { statusCode: 404 });
  }
  if (!participants.some((participant: any) => participant.userId === senderId)) {
    throw Object.assign(new Error("You are not a participant in this chat"), {
      statusCode: 403,
    });
  }

  const message = await ChatMessage.create({
    chatId,
    senderId,
    content: JSON.stringify(payload),
    // The messageType enum has no "action" member; the card is recognised by the
    // "type" field inside its JSON content, the same way money cards are.
    messageType: "text",
    isEncrypted: false,
    encryptionIv: "",
    status: "sent",
  });

  const messageWithSender = await ChatMessage.findByPk(message.id, {
    include: [
      {
        model: User,
        as: "sender",
        attributes: ["id", "firstName", "lastName"],
        include: [
          {
            model: Profile,
            as: "profile",
            attributes: ["profileImage"],
          },
        ],
      },
    ],
  });

  const io = app.get("io");
  if (io && messageWithSender) {
    const broadcastMessage = messageWithSender.toJSON();
    for (const participant of participants) {
      io.to(`user_${(participant as any).userId}`).emit("new_message", broadcastMessage);
    }
  }

  return messageWithSender;
};
