import express from "express";
import actionController from "../controllers/actionController";
import actionPurchaseController from "../controllers/actionPurchaseController";
import actionDisplayController from "../controllers/actionDisplayController";

const actionRouter = express.Router();

// Wizard Steps (Organization-specific)
actionRouter.post(
  "/organizations/:organizationId/actions/wizard/step-a",
  actionController.createActionStepA
);
actionRouter.put(
  "/actions/:actionId/wizard/step-b",
  actionController.updateActionStepB
);
actionRouter.post(
  "/actions/:actionId/sub-actions",
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
actionRouter.put("/actions/:actionId", actionController.updateAction);
actionRouter.delete("/actions/:actionId", actionController.deleteAction);

// Sub-Actions
actionRouter.get(
  "/actions/:actionId/sub-actions",
  actionController.getSubActions
);
actionRouter.put(
  "/sub-actions/:subActionId",
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

