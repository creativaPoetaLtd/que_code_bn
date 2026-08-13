import express, { RequestHandler } from "express";
import walletItemsController from "../controllers/walletItemsController";
import { authenticate } from "../middleware/auth.unified.middleware";
import fileUpload from "../middleware/multer";

const router = express.Router();

// All wallet routes require authentication
router.use(authenticate as RequestHandler);

// Aggregated wallet summary for a user or organization (single page data source)
router.get(
  "/:entityType/:entityId/summary",
  walletItemsController.getWalletSummary as RequestHandler
);

// Generic wallet items CRUD
router.get(
  "/:walletId/items",
  walletItemsController.listWalletItems as RequestHandler
);
router.post(
  "/:walletId/items",
  fileUpload.single("file"),
  walletItemsController.createWalletItem as RequestHandler
);
router.patch(
  "/items/:itemId",
  fileUpload.single("file"),
  walletItemsController.updateWalletItem as RequestHandler
);
router.delete(
  "/items/:itemId",
  walletItemsController.deleteWalletItem as RequestHandler
);

export default router;
