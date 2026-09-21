import express, { RequestHandler } from "express";
import pollController from "../controllers/pollController";
import { authenticate } from "../middleware/auth.unified.middleware";

const router = express.Router();

// This router is mounted at the root so both shapes read naturally:
//   POST /chats/:chatId/polls   - start a poll in a conversation
//   GET  /polls/:pollId         - live results
// Because of that, `authenticate` has to be attached per route. A router-level
// `router.use(authenticate)` would run for every request that reaches this point,
// matching route or not, and reject unauthenticated traffic meant for the routers
// mounted after this one - /auth/login among them.
router.post("/chats/:chatId/polls", authenticate as RequestHandler, pollController.createPoll as RequestHandler);
router.get("/polls/:pollId", authenticate as RequestHandler, pollController.getPoll as RequestHandler);
router.post("/polls/:pollId/vote", authenticate as RequestHandler, pollController.votePoll as RequestHandler);
router.post("/polls/:pollId/close", authenticate as RequestHandler, pollController.closePoll as RequestHandler);

export default router;
