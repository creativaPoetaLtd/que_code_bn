import { Response } from "express";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";
import { PollOption } from "../types/model";

const {
  sequelize,
  Poll,
  PollVote,
  User,
  Chat,
  ChatParticipant,
  ChatMessage,
  GroupMember,
} = database_models as any;

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 120;

class PollError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (res: Response, error: any, fallback: string) => {
  const status = error instanceof PollError ? error.status : 500;
  if (status === 500) console.error(fallback, error);
  res.status(status).json({
    success: false,
    message: status === 500 ? fallback : error.message,
  });
};

const nameOf = (user: any) =>
  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "Unknown";

const assertParticipant = async (chatId: string, userId: string) => {
  const participants = await ChatParticipant.findAll({
    where: { chatId },
    attributes: ["userId"],
  });
  if (participants.length === 0) throw new PollError("Chat not found", 404);
  if (!participants.some((participant: any) => participant.userId === userId)) {
    throw new PollError("You are not a participant in this chat", 403);
  }
  return participants.map((participant: any) => participant.userId) as string[];
};

/** A poll is closed once its creator says so, or once its deadline passes. */
const isClosed = (poll: any) =>
  poll.status === "closed" || Boolean(poll.closesAt && new Date(poll.closesAt) <= new Date());

/**
 * Who is allowed to end this poll early: its creator, plus any admin of the group
 * it lives in. Resolved once per request so a broadcast to a large group doesn't
 * re-query per recipient.
 */
const loadCloserIds = async (poll: any): Promise<Set<string>> => {
  const closerIds = new Set<string>([poll.createdBy]);
  if (poll.groupId) {
    const admins = await GroupMember.findAll({
      where: {
        groupId: poll.groupId,
        role: { [Op.in]: ["owner", "admin"] },
        status: "active",
      },
      attributes: ["userId"],
    });
    for (const admin of admins) closerIds.add((admin as any).userId);
  }
  return closerIds;
};

/**
 * Poll state as every participant sees it: tallies, who voted for what (unless the
 * poll is anonymous), and the caller's own selection so the card can highlight it.
 */
const buildPollPayload = async (poll: any, viewerId: string, closerIds?: Set<string>) => {
  const votes = await PollVote.findAll({
    where: { pollId: poll.id },
    include: [{ model: User, as: "voter", attributes: ["id", "firstName", "lastName"] }],
    order: [["createdAt", "ASC"]],
  });

  const voterIds = new Set<string>();
  const byOption = new Map<string, any[]>();
  for (const vote of votes) {
    voterIds.add((vote as any).userId);
    const existing = byOption.get((vote as any).optionId) || [];
    existing.push(vote);
    byOption.set((vote as any).optionId, existing);
  }

  const options = (poll.options as PollOption[]).map((option) => {
    const optionVotes = byOption.get(option.id) || [];
    return {
      id: option.id,
      text: option.text,
      voteCount: optionVotes.length,
      // Anonymous polls still report counts, never names
      voters: poll.isAnonymous
        ? []
        : optionVotes.map((vote: any) => ({
            userId: vote.userId,
            name: nameOf(vote.voter),
          })),
    };
  });

  return {
    id: poll.id,
    chatId: poll.chatId,
    groupId: poll.groupId,
    question: poll.question,
    options,
    allowMultiple: poll.allowMultiple,
    isAnonymous: poll.isAnonymous,
    closesAt: poll.closesAt,
    status: isClosed(poll) ? "closed" : "open",
    createdBy: poll.createdBy,
    createdByName: nameOf(poll.creator),
    createdAt: poll.createdAt,
    totalVotes: votes.length,
    voterCount: voterIds.size,
    myVotes: votes
      .filter((vote: any) => vote.userId === viewerId)
      .map((vote: any) => vote.optionId),
    canClose: (closerIds || (await loadCloserIds(poll))).has(viewerId),
  };
};

const loadPollOr404 = async (pollId: string) => {
  const poll = await Poll.findByPk(pollId, {
    include: [{ model: User, as: "creator", attributes: ["id", "firstName", "lastName"] }],
  });
  if (!poll) throw new PollError("Poll not found", 404);
  return poll;
};

/** Push fresh results to everyone in the chat so open cards update without a refresh. */
const broadcastPoll = async (req: AuthenticatedRequest, poll: any, participantIds: string[]) => {
  const io = req.app.get("io");
  if (!io) return;

  const closerIds = await loadCloserIds(poll);
  for (const participantId of participantIds) {
    // Each viewer needs their own myVotes and canClose, so the payload is per recipient
    const payload = await buildPollPayload(poll, participantId, closerIds);
    io.to(`user_${participantId}`).emit("poll_updated", payload);
  }
};

const createPoll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { question, options, allowMultiple, isAnonymous, closesAt } = req.body;

    const participantIds = await assertParticipant(chatId, userId);

    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion) throw new PollError("A question is required");
    if (trimmedQuestion.length > MAX_QUESTION_LENGTH) {
      throw new PollError(`Keep the question under ${MAX_QUESTION_LENGTH} characters`);
    }

    const cleanOptions: PollOption[] = (Array.isArray(options) ? options : [])
      .map((option: any) => String(typeof option === "string" ? option : option?.text || "").trim())
      .filter(Boolean)
      .map((text: string) => ({ id: uuidv4(), text: text.slice(0, MAX_OPTION_LENGTH) }));

    if (cleanOptions.length < MIN_OPTIONS) {
      throw new PollError(`A poll needs at least ${MIN_OPTIONS} options`);
    }
    if (cleanOptions.length > MAX_OPTIONS) {
      throw new PollError(`A poll can have at most ${MAX_OPTIONS} options`);
    }
    const uniqueTexts = new Set(cleanOptions.map((option) => option.text.toLowerCase()));
    if (uniqueTexts.size !== cleanOptions.length) {
      throw new PollError("Options must be different from each other");
    }

    let deadline: Date | null = null;
    if (closesAt) {
      deadline = new Date(closesAt);
      if (Number.isNaN(deadline.getTime())) throw new PollError("The closing time is not a valid date");
      if (deadline <= new Date()) throw new PollError("The closing time must be in the future");
    }

    const chat = await Chat.findByPk(chatId, { attributes: ["id", "isGroup", "groupId"] });

    const poll = await Poll.create({
      chatId,
      groupId: chat?.groupId || null,
      createdBy: userId,
      question: trimmedQuestion,
      options: cleanOptions,
      allowMultiple: Boolean(allowMultiple),
      isAnonymous: Boolean(isAnonymous),
      closesAt: deadline,
      status: "open",
    });

    const creator = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });

    // The card itself is a plain (non-E2EE) message so it renders for everyone,
    // including in secure conversations. It carries only the identifiers - live
    // results come from GET /polls/:pollId.
    const message = await ChatMessage.create({
      chatId,
      senderId: userId,
      content: JSON.stringify({
        type: "poll",
        pollId: poll.id,
        question: poll.question,
        optionCount: cleanOptions.length,
        allowMultiple: poll.allowMultiple,
        isAnonymous: poll.isAnonymous,
        closesAt: poll.closesAt,
        createdBy: userId,
        createdByName: nameOf(creator),
        timestamp: new Date().toISOString(),
      }),
      messageType: "text",
      isEncrypted: false,
      encryptionIv: "",
      status: "sent",
    });

    await poll.update({ messageId: message.id });

    const messageWithSender = await ChatMessage.findByPk(message.id, {
      include: [{ model: User, as: "sender", attributes: ["id", "firstName", "lastName"] }],
    });

    const io = req.app.get("io");
    if (io && messageWithSender) {
      const broadcastMessage = messageWithSender.toJSON();
      for (const participantId of participantIds) {
        io.to(`user_${participantId}`).emit("new_message", broadcastMessage);
      }
    }

    poll.setDataValue("creator", creator);
    res.status(201).json({
      success: true,
      message: "Poll created",
      data: await buildPollPayload(poll, userId),
    });
  } catch (error: any) {
    fail(res, error, "An error occurred while creating the poll");
  }
};

const getPoll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const poll = await loadPollOr404(req.params.pollId);
    await assertParticipant(poll.chatId, userId);

    res.status(200).json({
      success: true,
      data: await buildPollPayload(poll, userId),
    });
  } catch (error: any) {
    fail(res, error, "An error occurred while loading the poll");
  }
};

/**
 * Cast (or change) a vote. The submitted selection replaces whatever this person
 * chose before, so re-voting is a single idempotent call.
 */
const votePoll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { optionIds } = req.body;
    const poll = await loadPollOr404(req.params.pollId);
    const participantIds = await assertParticipant(poll.chatId, userId);

    if (isClosed(poll)) throw new PollError("This poll is closed", 409);

    const submitted: string[] = Array.from(
      new Set((Array.isArray(optionIds) ? optionIds : []).map((id: any) => String(id)))
    );
    if (submitted.length === 0) throw new PollError("Pick at least one option");
    if (!poll.allowMultiple && submitted.length > 1) {
      throw new PollError("This poll only allows one choice");
    }

    const validIds = new Set((poll.options as PollOption[]).map((option) => option.id));
    if (submitted.some((id) => !validIds.has(id))) {
      throw new PollError("That option is not part of this poll");
    }

    await sequelize.transaction(async (transaction: any) => {
      await PollVote.destroy({ where: { pollId: poll.id, userId }, transaction });
      await PollVote.bulkCreate(
        submitted.map((optionId) => ({ pollId: poll.id, userId, optionId })),
        { transaction }
      );
    });

    const payload = await buildPollPayload(poll, userId);
    await broadcastPoll(req, poll, participantIds);

    res.status(200).json({ success: true, message: "Vote recorded", data: payload });
  } catch (error: any) {
    fail(res, error, "An error occurred while recording your vote");
  }
};

/** Close a poll early. The creator can always close; in a group, so can an admin. */
const closePoll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const poll = await loadPollOr404(req.params.pollId);
    const participantIds = await assertParticipant(poll.chatId, userId);

    let canClose = poll.createdBy === userId;
    if (!canClose && poll.groupId) {
      const membership = await GroupMember.findOne({
        where: {
          groupId: poll.groupId,
          userId,
          role: { [Op.in]: ["owner", "admin"] },
          status: "active",
        },
      });
      canClose = Boolean(membership);
    }
    if (!canClose) {
      throw new PollError("Only the poll creator or a group admin can close this poll", 403);
    }

    if (poll.status !== "closed") await poll.update({ status: "closed" });

    const payload = await buildPollPayload(poll, userId);
    await broadcastPoll(req, poll, participantIds);

    res.status(200).json({ success: true, message: "Poll closed", data: payload });
  } catch (error: any) {
    fail(res, error, "An error occurred while closing the poll");
  }
};

export default {
  createPoll,
  getPoll,
  votePoll,
  closePoll,
};
