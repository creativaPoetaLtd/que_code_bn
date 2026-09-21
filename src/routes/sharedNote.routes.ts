import express, { RequestHandler } from "express";
import sharedNoteController from "../controllers/sharedNoteController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Mounted at the root:
//   POST  /chats/:chatId/notes - start a shared note in a conversation
//   GET   /notes/:noteId       - current text
//   PATCH /notes/:noteId       - save an edit (optimistic concurrency)
// `authenticate` is attached per route, not via router.use - see poll.routes.ts for
// why a router-level guard on a root-mounted router breaks unrelated endpoints.
router.post("/chats/:chatId/notes", authenticate as RequestHandler, sharedNoteController.createSharedNote as RequestHandler);
router.get("/chats/:chatId/notes", authenticate as RequestHandler, sharedNoteController.listChatNotes as RequestHandler);
router.get("/notes/:noteId", authenticate as RequestHandler, sharedNoteController.getSharedNote as RequestHandler);
router.patch("/notes/:noteId", authenticate as RequestHandler, sharedNoteController.updateSharedNote as RequestHandler);

export default router;
