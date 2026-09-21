import express, { RequestHandler } from "express";
import whiteboardController from "../controllers/whiteboardController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// Mounted at the root:
//   POST  /chats/:chatId/whiteboards - start a whiteboard in a conversation
//   GET   /whiteboards/:whiteboardId - current strokes
//   PATCH /whiteboards/:whiteboardId - add/remove strokes, or clear the board
// `authenticate` is attached per route, not via router.use - see poll.routes.ts for
// why a router-level guard on a root-mounted router breaks unrelated endpoints.
router.post("/chats/:chatId/whiteboards", authenticate as RequestHandler, whiteboardController.createWhiteboard as RequestHandler);
router.get("/whiteboards/:whiteboardId", authenticate as RequestHandler, whiteboardController.getWhiteboard as RequestHandler);
router.patch("/whiteboards/:whiteboardId", authenticate as RequestHandler, whiteboardController.updateWhiteboard as RequestHandler);

export default router;
