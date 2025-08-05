import express from "express";
import * as contactController from "../controllers/contactController";
import { authenticate } from "../middleware/auth.middleware";

const contactRouter = express.Router();

// Apply authentication middleware to all contact routes
contactRouter.use(authenticate);

// Contact invitation endpoints
contactRouter.post("/invite", contactController.inviteContact as express.RequestHandler);
contactRouter.put("/respond/:contactId", contactController.respondToInvitation as express.RequestHandler);

// Contact management endpoints
contactRouter.get("/", contactController.getContacts as express.RequestHandler);
contactRouter.get("/pending", contactController.getPendingInvitations as express.RequestHandler);
contactRouter.get("/accepted", contactController.getAcceptedContacts as express.RequestHandler);
// contactRouter.delete("/:contactId", contactController.removeContact);

// Public endpoint (no authentication required)


export default contactRouter;