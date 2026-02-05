import { Request, Response } from "express";
import Models from "../database/models";
import { Application } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { createContact } from "../utils/contactService";
import { createAndSendNotification } from "../utils/notificationService";
import { NotificationType } from "../utils/notificationConfig";
import { 
  notifyContactInvitationSent, 
  notifyContactRequestAccepted, 
  notifyContactRequestRejected 
} from "../utils/notificationHelpers";
import sendEmail from "../helpers/email";

// Generate a secure invitation token
function generateInvitationToken(inviterId: string, inviteeId: string): string {
  const payload = {
    inviterId,
    inviteeId,
    type: "contact_invitation",
    timestamp: Date.now(),
  };
  
  // Use JWT for token security with expiration
  return jwt.sign(payload, process.env.JWT_SECRET || "default-secret", {
    expiresIn: "7d",
  });
}

// Verify invitation token
function verifyInvitationToken(token: string): any {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "default-secret");
  } catch (error) {
    return null;
  }
}

// Generate a QR code data URL with invitation link
function generateInvitationQRData(token: string): string {
  const invitationUrl = `${process.env.FRONTEND_URL}/contacts/invitation/${token}`;
  return invitationUrl;
}

// Send contact invitation by public ID (for QR code scans)
export const sendContactInvitationByPublicId = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { publicId, message } = req.body;
    const inviterId = (req as any).user?.id;

    if (!publicId) {
      res.status(400).json({ message: "Public ID is required" });
      return;
    }

    if (!inviterId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    // Find invitee by public ID (user ID)
    const invitee = await models.User.findByPk(publicId);
    if (!invitee) {
      res.status(404).json({ message: "User not found with the provided public ID" });
      return;
    }

    const inviteeId = invitee.id;

    if (inviterId === inviteeId) {
      res.status(400).json({ message: "You cannot invite yourself" });
      return;
    }

    // Check if they are already contacts
    const existingContact = await models.Contact.findOne({
      where: {
        [Op.or]: [
          { userAId: inviterId, userBId: inviteeId },
          { userAId: inviteeId, userBId: inviterId },
        ],
      },
    });

    if (existingContact) {
      res.status(400).json({ message: "You are already connected with this user" });
      return;
    }

    // Check if invitation already exists
    const existingInvitation = await models.ContactInvitation.findOne({
      where: {
        inviterId,
        inviteeId,
        status: "pending",
      },
    });

    if (existingInvitation) {
      res.status(400).json({ message: "Invitation already sent to this user" });
      return;
    }

    // Get inviter details
    const inviter = await models.User.findByPk(inviterId);
    if (!inviter) {
      res.status(404).json({ message: "Inviter not found" });
      return;
    }

    // Generate secure token and set expiration
    const invitationToken = generateInvitationToken(inviterId, inviteeId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation
    const invitation = await models.ContactInvitation.create({
      inviterId,
      inviteeId,
      status: "pending",
      invitationToken,
      invitedAt: new Date(),
      expiresAt,
    });

    // Generate QR code data and invitation link
    const invitationUrl = generateInvitationQRData(invitationToken);

    // Send email notification
    try {
      const inviterData = inviter.get({ plain: true });
      const inviteeData = invitee.get({ plain: true });

      await sendEmail({
        to: inviteeData.email,
        subject: "Contact Invitation",
        type: "contact_invitation",
        data: {
          inviterName: `${inviterData.firstName} ${inviterData.lastName}`,
          inviterEmail: inviterData.email,
          acceptUrl: `${process.env.FRONTEND_URL}/contacts/invitation/${invitationToken}`,
          rejectUrl: `${process.env.FRONTEND_URL}/contacts/invitation/${invitationToken}?action=decline`,
          message: message || undefined,
          qrCodeUrl: invitationUrl,
        },
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
    }

    // Send in-app notification
    await createAndSendNotification(app, {
      type: NotificationType.CONTACT_REQUEST_RECEIVED,
      recipientId: inviteeId,
      data: {
        userId: inviterId,
        userName: `${inviter.firstName} ${inviter.lastName}`,
        userEmail: inviter.email,
        title: "Contact Invitation",
        message: `${inviter.firstName} ${inviter.lastName} wants to add you as a contact`,
        url: `/contacts/invitation/${invitationToken}`,
        actions: [
          {
            type: "accept",
            label: "Accept",
            url: `/contacts/invitation/${invitationToken}?action=accept`,
          },
          {
            type: "decline",
            label: "Decline",
            url: `/contacts/invitation/${invitationToken}?action=decline`,
          },
        ],
      },
    });

    const plainInvitation = invitation.get({ plain: true });

    res.status(201).json({
      message: "Contact invitation sent successfully",
      data: {
        ...plainInvitation,
        invitationUrl,
        inviteeName: `${invitee.firstName} ${invitee.lastName}`,
      },
    });
  } catch (error: any) {
    console.error("Send invitation by public ID error:", error);
    res.status(500).json({ 
      message: "An error occurred while sending the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Send contact invitation
export const sendContactInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { inviteeId, message } = req.body;
    const inviterId = (req as any).user?.id;

    if (!inviteeId) {
      res.status(400).json({ message: "Invitee ID is required" });
      return;
    }

    if (!inviterId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (inviterId === inviteeId) {
      res.status(400).json({ message: "You cannot invite yourself" });
      return;
    }

    // Check if invitee exists
    const invitee = await models.User.findByPk(inviteeId);
    if (!invitee) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if they are already contacts
    const existingContact = await models.Contact.findOne({
      where: {
        [Op.or]: [
          { userAId: inviterId, userBId: inviteeId },
          { userAId: inviteeId, userBId: inviterId },
        ],
      },
    });

    if (existingContact) {
      res.status(400).json({ message: "You are already connected with this user" });
      return;
    }

    // Check if invitation already exists
    const existingInvitation = await models.ContactInvitation.findOne({
      where: {
        inviterId,
        inviteeId,
        status: "pending",
      },
    });

    if (existingInvitation) {
      res.status(400).json({ message: "Invitation already sent to this user" });
      return;
    }

    // Get inviter details
    const inviter = await models.User.findByPk(inviterId);
    if (!inviter) {
      res.status(404).json({ message: "Inviter not found" });
      return;
    }

    // Generate secure token and set expiration
    const invitationToken = generateInvitationToken(inviterId, inviteeId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation
    const invitation = await models.ContactInvitation.create({
      inviterId,
      inviteeId,
      status: "pending",
      invitationToken,
      invitedAt: new Date(),
      expiresAt,
    });

    // Generate QR code data and invitation link
    const invitationUrl = generateInvitationQRData(invitationToken);

    // Send email notification
    try {
      const inviterData = inviter.get({ plain: true });
      const inviteeData = invitee.get({ plain: true });

      await sendEmail({
        to: inviteeData.email,
        subject: "Contact Invitation",
        type: "contact_invitation",
        data: {
          inviterName: `${inviterData.firstName} ${inviterData.lastName}`,
          inviterEmail: inviterData.email,
          acceptUrl: `${process.env.FRONTEND_URL}/contacts/invitation/${invitationToken}`,
          rejectUrl: `${process.env.FRONTEND_URL}/contacts/invitation/${invitationToken}?action=decline`,
          message: message || undefined,
          qrCodeUrl: invitationUrl,
        },
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
    }

    // Send in-app notification
    await createAndSendNotification(app, {
      type: NotificationType.CONTACT_REQUEST_RECEIVED,
      recipientId: inviteeId,
      data: {
        userId: inviterId,
        userName: `${inviter.firstName} ${inviter.lastName}`,
        userEmail: inviter.email,
        title: "Contact Invitation",
        message: `${inviter.firstName} ${inviter.lastName} wants to add you as a contact`,
        url: `/contacts/invitation/${invitationToken}`,
        actions: [
          {
            type: "accept",
            label: "Accept",
            url: `/contacts/invitation/${invitationToken}?action=accept`,
          },
          {
            type: "decline",
            label: "Decline",
            url: `/contacts/invitation/${invitationToken}?action=decline`,
          },
        ],
      },
    });

    const plainInvitation = invitation.get({ plain: true });

    res.status(201).json({
      message: "Contact invitation sent successfully",
      data: {
        ...plainInvitation,
        invitationUrl,
      },
    });
  } catch (error: any) {
    console.error("Send invitation error:", error);
    res.status(500).json({ 
      message: "An error occurred while sending the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Respond to invitation via token (public endpoint)
export const respondToInvitationByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { token } = req.params;
    const { action, userId } = req.body; // userId should come from authenticated user or token verification

    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    if (!action || !["accept", "decline"].includes(action)) {
      res.status(400).json({ message: "Valid action (accept or decline) is required" });
      return;
    }

    // Verify the token
    const tokenData = verifyInvitationToken(token);
    if (!tokenData) {
      res.status(400).json({ message: "Invalid or expired invitation token" });
      return;
    }

    // Find the invitation
    const invitation = await models.ContactInvitation.findOne({
      where: {
        invitationToken: token,
        status: "pending",
      },
      include: [
        { model: models.User, as: "inviter", attributes: ["id", "firstName", "lastName", "email"] },
        { model: models.User, as: "invitee", attributes: ["id", "firstName", "lastName", "email"] },
      ],
    });

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found or already responded" });
      return;
    }

    const invitationData = invitation.get({ plain: true });

    // Check if invitation has expired
    if (invitationData.expiresAt && new Date() > new Date(invitationData.expiresAt)) {
      await invitation.update({
        status: "expired",
        respondedAt: new Date(),
      });
      res.status(400).json({ message: "Invitation has expired" });
      return;
    }

    // Verify user authorization (if userId provided, it should match the invitee)
    if (userId && userId !== invitationData.inviteeId) {
      res.status(403).json({ message: "Not authorized to respond to this invitation" });
      return;
    }

    // Update invitation status
    const newStatus = action === "accept" ? "accepted" : "declined";
    await invitation.update({
      status: newStatus,
      respondedAt: new Date(),
    });

    // If accepted, create the contact relationship
    let contactCreated = false;
    if (action === "accept") {
      try {
        await createContact(app, invitationData.inviterId, invitationData.inviteeId);
        contactCreated = true;
      } catch (contactError) {
        console.error("Error creating contact:", contactError);
        // Continue - the invitation was still accepted
      }
    }

    // Send email notification to inviter
    try {
      if (invitationData.inviter && invitationData.invitee) {
        await sendEmail({
          to: invitationData.inviter.email,
          subject: `Contact Invitation ${action === "accept" ? "Accepted" : "Declined"}`,
          type: "invitation_response",
          data: {
            inviteeName: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName}`,
            inviteeEmail: invitationData.invitee.email,
            action: action,
            accepted: action === "accept" ? "true" : "false",
          },
        });
      }
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    // Send in-app notification to inviter
    if (invitationData.invitee) {
      await createAndSendNotification(app, {
        type: action === "accept" ? NotificationType.CONTACT_REQUEST_ACCEPTED : NotificationType.CONTACT_REQUEST_REJECTED,
        recipientId: invitationData.inviterId,
        data: {
          userId: invitationData.inviteeId,
          userName: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName}`,
          userEmail: invitationData.invitee.email,
          title: `Contact Invitation ${action === "accept" ? "Accepted" : "Declined"}`,
          message: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName} has ${action}ed your contact invitation`,
          url: action === "accept" ? "/contacts" : undefined,
        },
      });
    }

    res.status(200).json({
      message: `Invitation ${action}ed successfully`,
      contactCreated: contactCreated,
      invitation: invitationData,
    });
  } catch (error: any) {
    console.error("Respond to invitation error:", error);
    res.status(500).json({ 
      message: "An error occurred while responding to the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Respond to invitation by ID (authenticated endpoint)
export const respondToInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;
    const { action } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!action || !["accept", "decline"].includes(action)) {
      res.status(400).json({ message: "Valid action (accept or decline) is required" });
      return;
    }

    // Find the invitation
    const invitation = await models.ContactInvitation.findOne({
      where: {
        id,
        inviteeId: userId,
        status: "pending",
      },
      include: [
        { model: models.User, as: "inviter", attributes: ["id", "firstName", "lastName", "email"] },
        { model: models.User, as: "invitee", attributes: ["id", "firstName", "lastName", "email"] },
      ],
    });

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found or already responded" });
      return;
    }

    const invitationData = invitation.get({ plain: true });

    // Check if invitation has expired
    if (invitationData.expiresAt && new Date() > new Date(invitationData.expiresAt)) {
      await invitation.update({
        status: "expired",
        respondedAt: new Date(),
      });
      res.status(400).json({ message: "Invitation has expired" });
      return;
    }

    // Update invitation status
    const newStatus = action === "accept" ? "accepted" : "declined";
    await invitation.update({
      status: newStatus,
      respondedAt: new Date(),
    });

    // If accepted, create the contact relationship
    let contactCreated = false;
    if (action === "accept") {
      try {
        await createContact(app, invitationData.inviterId, invitationData.inviteeId);
        contactCreated = true;
      } catch (contactError) {
        console.error("Error creating contact:", contactError);
      }
    }

    // Send email notification to inviter
    try {
      if (invitationData.inviter && invitationData.invitee) {
        await sendEmail({
          to: invitationData.inviter.email,
          subject: `Contact Invitation ${action === "accept" ? "Accepted" : "Declined"}`,
          type: "invitation_response",
          data: {
            inviteeName: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName}`,
            inviteeEmail: invitationData.invitee.email,
            action: action,
            accepted: action === "accept" ? "true" : "false",
          },
        });
      }
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    // Send in-app notification to inviter
    if (invitationData.invitee) {
      await createAndSendNotification(app, {
        type: action === "accept" ? NotificationType.CONTACT_REQUEST_ACCEPTED : NotificationType.CONTACT_REQUEST_REJECTED,
        recipientId: invitationData.inviterId,
        data: {
          userId: invitationData.inviteeId,
          userName: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName}`,
          userEmail: invitationData.invitee.email,
          title: `Contact Invitation ${action === "accept" ? "Accepted" : "Declined"}`,
          message: `${invitationData.invitee.firstName} ${invitationData.invitee.lastName} has ${action}ed your contact invitation`,
          url: action === "accept" ? "/contacts" : undefined,
        },
      });
    }

    res.status(200).json({
      message: `Invitation ${action}ed successfully`,
      contactCreated: contactCreated,
      invitation: invitationData,
    });
  } catch (error: any) {
    console.error("Respond to invitation error:", error);
    res.status(500).json({ 
      message: "An error occurred while responding to the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get received invitations for current user
export const getReceivedInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const userId = (req as any).user?.id;
    const { status, page = 1, limit = 20 } = req.query;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = { inviteeId: userId };
    
    if (status) {
      whereClause.status = status;
    }

    const [invitations, totalCount] = await Promise.all([
      models.ContactInvitation.findAll({
        where: whereClause,
        include: [
          { model: models.User, as: "inviter", attributes: ["id", "firstName", "lastName", "email"] },
        ],
        order: [["invitedAt", "DESC"]],
        limit: Number(limit),
        offset,
      }),
      models.ContactInvitation.count({ where: whereClause }),
    ]);

    const plainInvitations = invitations.map((invitation) => invitation.get({ plain: true }));

    res.status(200).json({
      invitations: plainInvitations,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error: any) {
    console.error("Get received invitations error:", error);
    res.status(500).json({ 
      message: "An error occurred while fetching invitations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get sent invitations for current user
export const getSentInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const userId = (req as any).user?.id;
    const { status, page = 1, limit = 20 } = req.query;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = { inviterId: userId };
    
    if (status) {
      whereClause.status = status;
    }

    const [invitations, totalCount] = await Promise.all([
      models.ContactInvitation.findAll({
        where: whereClause,
        include: [
          { model: models.User, as: "invitee", attributes: ["id", "firstName", "lastName", "email"] },
        ],
        order: [["invitedAt", "DESC"]],
        limit: Number(limit),
        offset,
      }),
      models.ContactInvitation.count({ where: whereClause }),
    ]);

    const plainInvitations = invitations.map((invitation) => invitation.get({ plain: true }));

    res.status(200).json({
      invitations: plainInvitations,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error: any) {
    console.error("Get sent invitations error:", error);
    res.status(500).json({ 
      message: "An error occurred while fetching invitations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Cancel a pending invitation
export const cancelInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const invitation = await models.ContactInvitation.findOne({
      where: {
        id,
        inviterId: userId,
        status: "pending",
      },
      include: [
        { model: models.User, as: "invitee", attributes: ["id", "firstName", "lastName", "email"] },
      ],
    });

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found or cannot be cancelled" });
      return;
    }

    const invitationData = invitation.get({ plain: true });

    // Delete the invitation
    await invitation.destroy();

    // Send notification to invitee
    await createAndSendNotification(app, {
      type: NotificationType.CONTACT_REQUEST_REJECTED,
      recipientId: invitationData.inviteeId,
      data: {
        userId: userId,
        userName: "Contact request sender",
        title: "Contact Invitation Cancelled",
        message: "A contact invitation sent to you has been cancelled",
      },
    });

    res.status(200).json({ message: "Invitation cancelled successfully" });
  } catch (error: any) {
    console.error("Cancel invitation error:", error);
    res.status(500).json({ 
      message: "An error occurred while cancelling the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get invitation by token (for public viewing)
export const getInvitationByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.app as Application;
    const models = app.get("models") as ReturnType<typeof Models>;
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    // Verify the token
    const tokenData = verifyInvitationToken(token);
    if (!tokenData) {
      res.status(400).json({ message: "Invalid or expired invitation token" });
      return;
    }

    // Find the invitation
    const invitation = await models.ContactInvitation.findOne({
      where: {
        invitationToken: token,
      },
      include: [
        { model: models.User, as: "inviter", attributes: ["id", "firstName", "lastName", "email"] },
        { model: models.User, as: "invitee", attributes: ["id", "firstName", "lastName", "email"] },
      ],
    });

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found" });
      return;
    }

    const invitationData = invitation.get({ plain: true });

    // Check if invitation has expired
    if (invitationData.expiresAt && new Date() > new Date(invitationData.expiresAt)) {
      if (invitationData.status === "pending") {
        await invitation.update({
          status: "expired",
          respondedAt: new Date(),
        });
        invitationData.status = "expired";
      }
    }

    res.status(200).json({
      invitation: invitationData,
      isExpired: invitationData.status === "expired" || 
                 (invitationData.expiresAt && new Date() > new Date(invitationData.expiresAt)),
      canRespond: invitationData.status === "pending" && 
                  (!invitationData.expiresAt || new Date() <= new Date(invitationData.expiresAt)),
    });
  } catch (error: any) {
    console.error("Get invitation by token error:", error);
    res.status(500).json({ 
      message: "An error occurred while fetching the invitation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export default {
  send_invitation: sendContactInvitation,
  send_invitation_by_public_id: sendContactInvitationByPublicId,
  respond_to_invitation: respondToInvitation,
  respond_to_invitation_by_token: respondToInvitationByToken,
  get_received_invitations: getReceivedInvitations,
  get_sent_invitations: getSentInvitations,
  cancel_invitation: cancelInvitation,
  get_invitation_by_token: getInvitationByToken,
};