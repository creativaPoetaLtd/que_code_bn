import { Router, RequestHandler } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getLinkPreview } from "../controllers/linkPreviewController";

const router = Router();

// Requires a valid session token — prevents anonymous abuse of the proxy
router.use(authenticate);

// GET /api/v1/link-preview?url=<encoded_url>
router.get("/", getLinkPreview as RequestHandler);

export default router;
