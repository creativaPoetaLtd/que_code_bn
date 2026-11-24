import express from "express";
import actionController from "../controllers/actionController";
import actionPurchaseController from "../controllers/actionPurchaseController";
import actionDisplayController from "../controllers/actionDisplayController";
import { RequestHandler } from "express";
import {
  actionCoverImageUpload,
  subActionMediaFields,
  SUB_ACTION_MAX_GALLERY_IMAGES,
} from "../middleware/multer";
import { authenticate } from "../middleware/auth.unified.middleware";
import {
  requireActionOwner,
  requireQRObjectOwner,
  requireSelfOrganization,
  requireSubActionOwner,
} from "../middleware/ownership.middleware";

const actionRouter = express.Router();

// Managing actions is limited to the owning organization (or an admin).
const auth = authenticate as unknown as RequestHandler;
const ownsOrganization = requireSelfOrganization("organizationId") as unknown as RequestHandler;
const ownsAction = requireActionOwner as unknown as RequestHandler;
const ownsSubAction = requireSubActionOwner as unknown as RequestHandler;
const ownsQRObject = requireQRObjectOwner as unknown as RequestHandler;

// Error handling middleware for multer
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof Error) {
    if (err.message.includes('File type')) {
      return res.status(400).json({
        message: "Invalid file type",
        error: err.message
      });
    }
    if ((err as any).code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: "File too large",
        error: "File size must be less than 10MB"
      });
    }
    if ((err as any).code === 'LIMIT_FILE_COUNT' || (err as any).code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: "Too many files",
        error: `A cover image plus up to ${SUB_ACTION_MAX_GALLERY_IMAGES} gallery images are allowed`
      });
    }
  }
  next(err);
};

// Wizard Steps (Organization-specific)
actionRouter.post(
  "/organizations/:organizationId/actions/wizard/step-a",
  auth,
  ownsOrganization,
  actionCoverImageUpload.single("coverImage"),
  handleMulterError,
  actionController.createActionStepA
);
actionRouter.put(
  "/actions/:actionId/wizard/step-b",
  auth,
  ownsAction,
  actionController.updateActionStepB
);
actionRouter.post(
  "/actions/:actionId/sub-actions",
  auth,
  ownsAction,
  subActionMediaFields,
  handleMulterError,
  actionController.createSubAction
);
actionRouter.put(
  "/actions/:actionId/wizard/step-d",
  auth,
  ownsAction,
  actionController.updateActionStepD
);
actionRouter.put(
  "/actions/:actionId/wizard/step-e",
  auth,
  ownsAction,
  actionController.updateActionStepE
);
actionRouter.put(
  "/actions/:actionId/wizard/step-f",
  auth,
  ownsAction,
  actionController.updateActionStepF
);
actionRouter.put(
  "/actions/:actionId/wizard/step-g",
  auth,
  ownsAction,
  actionController.updateActionStepG
);
actionRouter.put(
  "/actions/:actionId/wizard/step-h",
  auth,
  ownsAction,
  actionController.updateActionStepH
);
actionRouter.put(
  "/actions/:actionId/publish",
  auth,
  ownsAction,
  actionController.publishAction
);

// Public Display Routes (MUST come before parameterized routes)
actionRouter.get("/actions/public", actionDisplayController.getAllPublishedActions);
actionRouter.get("/actions/public/:slug", actionDisplayController.getPublicActionBySlug);
actionRouter.get(
  "/organizations/:organizationId/actions/public",
  actionDisplayController.getPublicActions
);

// Action CRUD (Organization-specific)
actionRouter.get(
  "/organizations/:organizationId/actions",
  actionController.getOrganizationActions
);
actionRouter.get("/actions/:actionId", actionController.getActionById);
actionRouter.put(
  "/actions/:actionId",
  auth,
  ownsAction,
  actionCoverImageUpload.single("coverImage"),
  handleMulterError,
  actionController.updateAction
);
actionRouter.delete("/actions/:actionId", auth, ownsAction, actionController.deleteAction);

// Sub-Actions
actionRouter.get(
  "/actions/:actionId/sub-actions",
  actionController.getSubActions
);
actionRouter.get(
  "/sub-actions/:subActionId",
  actionController.getSubActionById
);
actionRouter.put(
  "/sub-actions/:subActionId",
  auth,
  ownsSubAction,
  subActionMediaFields,
  handleMulterError,
  actionController.updateSubAction
);
actionRouter.delete(
  "/sub-actions/:subActionId",
  auth,
  ownsSubAction,
  actionController.deleteSubAction
);


// Purchase Routes
actionRouter.post(
  "/actions/:actionId/purchase",
  auth,
  actionPurchaseController.purchaseAction
);

// User QR Objects & Purchases
actionRouter.get(
  "/users/:userId/qr-objects",
  actionPurchaseController.getUserQRObjects
);
actionRouter.get(
  "/users/:userId/purchases",
  actionPurchaseController.getUserPurchases
);

// Transfer ownership of a purchased ticket/pass. Authenticated: the sender is the
// token holder, and the recipient may be any user (contact, profile link, or QR).
actionRouter.post(
  "/action-purchases/:purchaseId/transfer",
  authenticate as RequestHandler,
  actionPurchaseController.transferActionPurchase
);

// Share an action into a conversation as a card (no ownership changes)
actionRouter.post(
  "/actions/:actionId/share-to-chat",
  authenticate as RequestHandler,
  actionPurchaseController.shareActionToChat
);

// QR Object Validation
actionRouter.get(
  "/qr-objects/:qrObjectId/validate",
  actionPurchaseController.validateQRObject
);
actionRouter.post(
  "/qr-objects/:qrObjectId/use",
  auth,
  ownsQRObject,
  actionPurchaseController.useQRObject
);

export default actionRouter;

