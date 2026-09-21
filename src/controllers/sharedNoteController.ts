import { Response } from "express";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";

const { SharedNote, User, Chat, ChatParticipant, ChatMessage } = database_models as any;

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 20000;
const SNIPPET_LENGTH = 140;

class NoteError extends Error {
  status: number;
  payload?: any;
  constructor(message: string, status = 400, payload?: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const fail = (res: Response, error: any, fallback: string) => {
  const status = error instanceof NoteError ? error.status : 500;
  if (status === 500) console.error(fallback, error);
  res.status(status).json({
    success: false,
    message: status === 500 ? fallback : error.message,
    ...(error instanceof NoteError && error.payload ? { data: error.payload } : {}),
  });
};

const nameOf = (user: any) =>
  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "Unknown";

const assertParticipant = async (chatId: string, userId: string) => {
  const participants = await ChatParticipant.findAll({
    where: { chatId },
    attributes: ["userId"],
  });
  if (participants.length === 0) throw new NoteError("Chat not found", 404);
  if (!participants.some((participant: any) => participant.userId === userId)) {
    throw new NoteError("You are not a participant in this chat", 403);
  }
  return participants.map((participant: any) => participant.userId) as string[];
};

/** First line of the body, trimmed - what the chat card previews */
const snippetOf = (content: string) => {
  const flat = String(content || "").replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH)}…` : flat;
};

const notePayload = (note: any) => ({
  id: note.id,
  chatId: note.chatId,
  groupId: note.groupId,
  title: note.title,
  content: note.content,
  version: note.version,
  snippet: snippetOf(note.content),
  createdBy: note.createdBy,
  createdByName: nameOf(note.creator),
  lastEditedBy: note.lastEditedBy,
  lastEditedByName: note.lastEditor ? nameOf(note.lastEditor) : null,
  lastEditedAt: note.lastEditedAt,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

/** What the pinned bar and the notes panel need - no body, those can be long */
const noteSummary = (note: any) => {
  const { content, ...summary } = notePayload(note);
  return summary;
};

const NOTE_INCLUDES = [
  { model: User, as: "creator", attributes: ["id", "firstName", "lastName"] },
  { model: User, as: "lastEditor", attributes: ["id", "firstName", "lastName"] },
];

/**
 * A note whose card was deleted is gone as far as the chat is concerned.
 * Deleting the card now takes the note with it, but notes orphaned before that
 * existed are still on file - this keeps them out of the bar and the panel
 * instead of leaving them pinned with no way to reach them.
 */
const withDeletedCards = async (notes: any[]): Promise<Set<string>> => {
  const messageIds = notes.map((note) => note.messageId).filter(Boolean);
  if (messageIds.length === 0) return new Set();

  const deletedMessages = await ChatMessage.findAll({
    where: { id: messageIds, deletedAt: { [Op.ne]: null } },
    attributes: ["id"],
  });
  return new Set(deletedMessages.map((message: any) => message.id));
};

const loadNoteOr404 = async (noteId: string) => {
  const note = await SharedNote.findByPk(noteId, { include: NOTE_INCLUDES });
  if (!note) throw new NoteError("Note not found", 404);
  return note;
};

const cleanTitle = (value: any) => {
  const title = String(value || "").trim();
  if (!title) throw new NoteError("A title is required");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new NoteError(`Keep the title under ${MAX_TITLE_LENGTH} characters`);
  }
  return title;
};

const cleanContent = (value: any) => {
  const content = String(value ?? "");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new NoteError(`A note can hold at most ${MAX_CONTENT_LENGTH} characters`);
  }
  return content;
};

/** Everyone in the chat keeps their open copy in step. */
const broadcastNote = (req: AuthenticatedRequest, note: any, participantIds: string[]) => {
  const io = req.app.get("io");
  if (!io) return;
  const payload = notePayload(note);
  for (const participantId of participantIds) {
    io.to(`user_${participantId}`).emit("shared_note_updated", payload);
  }
};

const createSharedNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const title = cleanTitle(req.body.title);
    const content = cleanContent(req.body.content);

    const participantIds = await assertParticipant(chatId, userId);
    const chat = await Chat.findByPk(chatId, { attributes: ["id", "isGroup", "groupId"] });

    const note = await SharedNote.create({
      chatId,
      groupId: chat?.groupId || null,
      createdBy: userId,
      title,
      content,
      version: 1,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
    });

    const creator = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });

    // Plain (non-E2EE) card so it renders for everyone, secure chats included. It
    // carries identifiers only - the live note comes from GET /notes/:noteId.
    const message = await ChatMessage.create({
      chatId,
      senderId: userId,
      content: JSON.stringify({
        type: "shared_note",
        noteId: note.id,
        title: note.title,
        snippet: snippetOf(content),
        createdBy: userId,
        createdByName: nameOf(creator),
        timestamp: new Date().toISOString(),
      }),
      messageType: "text",
      isEncrypted: false,
      encryptionIv: "",
      status: "sent",
    });

    await note.update({ messageId: message.id });

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

    note.setDataValue("creator", creator);
    note.setDataValue("lastEditor", creator);

    // Tell every participant a note now exists, so their pinned bar shows it without
    // waiting for a refetch.
    broadcastNote(req, note, participantIds);

    res.status(201).json({
      success: true,
      message: "Note shared",
      data: notePayload(note),
    });
  } catch (error: any) {
    fail(res, error, "An error occurred while creating the note");
  }
};

const getSharedNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const note = await loadNoteOr404(req.params.noteId);
    await assertParticipant(note.chatId, userId);

    const deletedCardIds = await withDeletedCards([note]);
    if (note.messageId && deletedCardIds.has(note.messageId)) {
      throw new NoteError("This note was deleted", 404);
    }

    res.status(200).json({ success: true, data: notePayload(note) });
  } catch (error: any) {
    fail(res, error, "An error occurred while loading the note");
  }
};

/**
 * Save an edit. The client sends the version it started from; if someone else saved
 * in the meantime the write is refused and their copy comes back with the 409, so
 * the editor can show both instead of quietly overwriting someone's work.
 */
const updateSharedNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const note = await loadNoteOr404(req.params.noteId);
    const participantIds = await assertParticipant(note.chatId, userId);

    const title = req.body.title === undefined ? note.title : cleanTitle(req.body.title);
    const content = req.body.content === undefined ? note.content : cleanContent(req.body.content);
    const baseVersion = Number(req.body.baseVersion);

    if (!Number.isFinite(baseVersion)) {
      throw new NoteError("baseVersion is required");
    }
    if (baseVersion !== note.version) {
      throw new NoteError(
        `${note.lastEditor ? nameOf(note.lastEditor) : "Someone"} edited this note first`,
        409,
        notePayload(note)
      );
    }

    if (title === note.title && content === note.content) {
      res.status(200).json({ success: true, message: "No changes", data: notePayload(note) });
      return;
    }

    const editor = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName"],
    });

    await note.update({
      title,
      content,
      version: note.version + 1,
      lastEditedBy: userId,
      lastEditedAt: new Date(),
    });
    note.setDataValue("lastEditor", editor);

    broadcastNote(req, note, participantIds);

    res.status(200).json({ success: true, message: "Note saved", data: notePayload(note) });
  } catch (error: any) {
    fail(res, error, "An error occurred while saving the note");
  }
};

/** Every note in a conversation, most recently touched first. */
const listChatNotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    await assertParticipant(chatId, userId);

    const notes = await SharedNote.findAll({
      where: { chatId },
      include: NOTE_INCLUDES,
      order: [
        ["lastEditedAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const deletedCardIds = await withDeletedCards(notes);
    const visible = notes.filter(
      (note: any) => !note.messageId || !deletedCardIds.has(note.messageId)
    );

    res.status(200).json({
      success: true,
      data: visible.map(noteSummary),
    });
  } catch (error: any) {
    fail(res, error, "An error occurred while loading the notes");
  }
};

export default {
  createSharedNote,
  getSharedNote,
  updateSharedNote,
  listChatNotes,
};
