import { randomUUID } from "crypto";
import { Response } from "express";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";
import { WhiteboardStroke } from "../types/model";

const { Whiteboard, User, Chat, ChatParticipant, ChatMessage } = database_models as any;

// Logical drawing surface every board is recorded in, independent of any one
// screen's actual pixels - the frontend maps pointer coordinates into this space
// so a board looks the same however big the canvas is rendered.
export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 500;

const MAX_STROKES = 4000;
const MAX_POINTS_PER_STROKE = 800; // ~400 x,y samples of one continuous drag
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 40;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

class WhiteboardError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (res: Response, error: any, fallback: string) => {
  const status = error instanceof WhiteboardError ? error.status : 500;
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
  if (participants.length === 0) throw new WhiteboardError("Chat not found", 404);
  if (!participants.some((participant: any) => participant.userId === userId)) {
    throw new WhiteboardError("You are not a participant in this chat", 403);
  }
  return participants.map((participant: any) => participant.userId) as string[];
};

/** Validates and normalizes one stroke coming off the wire - the author is always
 *  the requesting user, never taken from the client, so undo can trust it later. */
const cleanStroke = (raw: any, userId: string): WhiteboardStroke => {
  if (!raw || !Array.isArray(raw.points)) {
    throw new WhiteboardError("Invalid stroke");
  }
  if (raw.points.length < 4 || raw.points.length > MAX_POINTS_PER_STROKE || raw.points.length % 2 !== 0) {
    throw new WhiteboardError("Invalid stroke length");
  }

  const points = raw.points.map((value: any, index: number) => {
    const num = Number(value);
    if (!Number.isFinite(num)) throw new WhiteboardError("Invalid stroke point");
    const max = index % 2 === 0 ? BOARD_WIDTH : BOARD_HEIGHT;
    return Math.max(0, Math.min(max, num));
  });

  const color = typeof raw.color === "string" && COLOR_RE.test(raw.color) ? raw.color : "#111111";
  const widthNum = Number(raw.width);
  const width = Number.isFinite(widthNum)
    ? Math.max(MIN_STROKE_WIDTH, Math.min(MAX_STROKE_WIDTH, widthNum))
    : 3;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : randomUUID(),
    authorId: userId,
    points,
    color,
    width,
    ...(raw.erase ? { erase: true } : {}),
  };
};

const whiteboardPayload = (board: any) => ({
  id: board.id,
  chatId: board.chatId,
  groupId: board.groupId,
  strokes: board.strokes,
  version: board.version,
  createdBy: board.createdBy,
  createdByName: nameOf(board.creator),
  lastEditedBy: board.lastEditedBy,
  lastEditedByName: board.lastEditor ? nameOf(board.lastEditor) : null,
  lastEditedAt: board.lastEditedAt,
  createdAt: board.createdAt,
  updatedAt: board.updatedAt,
});

const BOARD_INCLUDES = [
  { model: User, as: "creator", attributes: ["id", "firstName", "lastName"] },
  { model: User, as: "lastEditor", attributes: ["id", "firstName", "lastName"] },
];

const loadBoardOr404 = async (whiteboardId: string) => {
  const board = await Whiteboard.findByPk(whiteboardId, { include: BOARD_INCLUDES });
  if (!board) throw new WhiteboardError("Whiteboard not found", 404);
  return board;
};

/** Everyone in the chat keeps their open canvas in step. */
const broadcastBoard = (req: AuthenticatedRequest, board: any, participantIds: string[]) => {
  const io = req.app.get("io");
  if (!io) return;
  const payload = whiteboardPayload(board);
  for (const participantId of participantIds) {
    io.to(`user_${participantId}`).emit("whiteboard_updated", payload);
  }
};

const createWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const rawStrokes = Array.isArray(req.body.strokes) ? req.body.strokes : [];
    if (rawStrokes.length > MAX_STROKES) {
      throw new WhiteboardError(`A board can hold at most ${MAX_STROKES} strokes`);
    }
    const strokes = rawStrokes.map((stroke: any) => cleanStroke(stroke, userId));

    const participantIds = await assertParticipant(chatId, userId);
    const chat = await Chat.findByPk(chatId, { attributes: ["id", "isGroup", "groupId"] });

    const board = await Whiteboard.create({
      chatId,
      groupId: chat?.groupId || null,
      createdBy: userId,
      strokes,
      version: 1,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
    });

    const creator = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });

    // Plain (non-E2EE) card so it renders for everyone, secure chats included. It
    // carries the id only - the live board comes from GET /whiteboards/:id.
    const message = await ChatMessage.create({
      chatId,
      senderId: userId,
      content: JSON.stringify({
        type: "whiteboard",
        whiteboardId: board.id,
        createdBy: userId,
        createdByName: nameOf(creator),
        timestamp: new Date().toISOString(),
      }),
      messageType: "text",
      isEncrypted: false,
      encryptionIv: "",
      status: "sent",
    });

    await board.update({ messageId: message.id });

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

    board.setDataValue("creator", creator);
    board.setDataValue("lastEditor", creator);

    res.status(201).json({
      success: true,
      message: "Whiteboard shared",
      data: whiteboardPayload(board),
    });
  } catch (error: any) {
    fail(res, error, "An error occurred while creating the whiteboard");
  }
};

const getWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const board = await loadBoardOr404(req.params.whiteboardId);
    await assertParticipant(board.chatId, userId);

    res.status(200).json({ success: true, data: whiteboardPayload(board) });
  } catch (error: any) {
    fail(res, error, "An error occurred while loading the whiteboard");
  }
};

/**
 * Apply a delta rather than replace the whole board: new strokes are appended,
 * and a stroke can only be removed by the person who drew it. Because drawing is
 * inherently a list of independent marks, two people drawing at once just merge -
 * there's no destructive "someone else saved first" conflict to resolve here the
 * way there is for a text note.
 */
const updateWhiteboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const board = await loadBoardOr404(req.params.whiteboardId);
    const participantIds = await assertParticipant(board.chatId, userId);

    const clear = req.body.clear === true;
    const removeStrokeIds: string[] = Array.isArray(req.body.removeStrokeIds)
      ? req.body.removeStrokeIds.filter((id: any) => typeof id === "string")
      : [];
    const rawAdd = Array.isArray(req.body.addStrokes) ? req.body.addStrokes : [];

    let nextStrokes: WhiteboardStroke[] = clear ? [] : [...board.strokes];

    if (!clear && removeStrokeIds.length) {
      const toRemove = new Set(removeStrokeIds);
      // Only your own marks can be taken back - not someone else's
      nextStrokes = nextStrokes.filter(
        (stroke) => !(toRemove.has(stroke.id) && stroke.authorId === userId)
      );
    }

    if (rawAdd.length) {
      if (nextStrokes.length + rawAdd.length > MAX_STROKES) {
        throw new WhiteboardError(`This board is full at ${MAX_STROKES} strokes — clear it to keep drawing`);
      }
      nextStrokes = nextStrokes.concat(rawAdd.map((stroke: any) => cleanStroke(stroke, userId)));
    }

    if (!clear && !removeStrokeIds.length && !rawAdd.length) {
      res.status(200).json({ success: true, message: "No changes", data: whiteboardPayload(board) });
      return;
    }

    const editor = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });

    await board.update({
      strokes: nextStrokes,
      version: board.version + 1,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
    });
    board.setDataValue("lastEditor", editor);

    broadcastBoard(req, board, participantIds);

    res.status(200).json({ success: true, message: "Whiteboard saved", data: whiteboardPayload(board) });
  } catch (error: any) {
    fail(res, error, "An error occurred while saving the whiteboard");
  }
};

export default {
  createWhiteboard,
  getWhiteboard,
  updateWhiteboard,
};
