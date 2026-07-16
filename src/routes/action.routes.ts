import express from "express";
import actionController from "../controllers/actionController";
import actionPurchaseController from "../controllers/actionPurchaseController";
import actionDisplayController from "../controllers/actionDisplayController";
import {
  actionCoverImageUpload,
  subActionMediaFields,
  SUB_ACTION_MAX_GALLERY_IMAGES,
} from "../middleware/multer";

const actionRouter = express.Router();

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
  actionCoverImageUpload.single("coverImage"),
  handleMulterError,
  actionController.createActionStepA
);
actionRouter.put(
  "/actions/:actionId/wizard/step-b",
  actionController.updateActionStepB
);
actionRouter.post(
  "/actions/:actionId/sub-actions",
  subActionMediaFields,
  handleMulterError,
  actionController.createSubAction
);
actionRouter.put(
  "/actions/:actionId/wizard/step-d",
  actionController.updateActionStepD
);
actionRouter.put(
  "/actions/:actionId/wizard/step-e",
  actionController.updateActionStepE
);
actionRouter.put(
  "/actions/:actionId/wizard/step-f",
  actionController.updateActionStepF
);
actionRouter.put(
  "/actions/:actionId/wizard/step-g",
  actionController.updateActionStepG
);
actionRouter.put(
  "/actions/:actionId/wizard/step-h",
  actionController.updateActionStepH
);
actionRouter.put(
  "/actions/:actionId/publish",
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
  actionCoverImageUpload.single("coverImage"),
  handleMulterError,
  actionController.updateAction
);
actionRouter.delete("/actions/:actionId", actionController.deleteAction);

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
  subActionMediaFields,
  handleMulterError,
  actionController.updateSubAction
);
actionRouter.delete(
  "/sub-actions/:subActionId",
  actionController.deleteSubAction
);


// Purchase Routes
actionRouter.post(
  "/actions/:actionId/purchase",
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

// Transfer ownership of a purchased ticket/pass to a contact
actionRouter.post(
  "/action-purchases/:purchaseId/transfer",
  actionPurchaseController.transferActionPurchase
);

// QR Object Validation
actionRouter.get(
  "/qr-objects/:qrObjectId/validate",
  actionPurchaseController.validateQRObject
);
actionRouter.post(
  "/qr-objects/:qrObjectId/use",
  actionPurchaseController.useQRObject
);

export default actionRouter;

