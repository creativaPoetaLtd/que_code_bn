import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ContactInvitationAttributes,
  ContactInvitationCreationAttributes,
  ContactAttributes,
  ContactCreationAttributes,
  UserModelAttributes,
} from "../types/model";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import sendEmail from "../helpers/email";
import { create_or_get_chat_internal } from "./chatController";

// Send a contact invitation
export const send_contact_invitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const inviterId = req.user?.id;
    const { inviteeId } = req.body;

    if (!inviterId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!inviteeId) {
      res.status(400).json({ message: "Invitee ID is required" });
      return;
    }

    if (inviterId === inviteeId) {
      res.status(400).json({ message: "Cannot invite yourself" });
      return;
    }

    // Check if invitee exists
    const invitee = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      {
        where: { id: inviteeId },
        attributes: ["id", "firstName", "lastName", "email"],
      }
    );

    if (!invitee) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get inviter information for email
    const inviter = await read_function<UserModelAttributes>(
      "User",
      "findOne",
      {
        where: { id: inviterId },
        attributes: ["id", "firstName", "lastName", "email"],
      }
    );

    if (!inviter) {
      res.status(404).json({ message: "Inviter not found" });
      return;
    }

    // Check if they are already contacts
    const existingContact = await read_function<ContactAttributes>(
      "Contact",
      "findOne",
      {
        where: {
          [Op.or]: [
            { userAId: inviterId, userBId: inviteeId },
            { userAId: inviteeId, userBId: inviterId },
          ],
        },
      }
    );

    if (existingContact) {
      res.status(400).json({ message: "Already contacts" });
      return;
    }

    // Check if there's already a pending invitation
    const existingInvitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: {
          [Op.or]: [
            { inviterId, inviteeId, status: "pending" },
            { inviterId: inviteeId, inviteeId: inviterId, status: "pending" },
          ],
        },
      }
    );

    if (existingInvitation) {
      res.status(400).json({ message: "Invitation already pending" });
      return;
    }

    // Create invitation
    const invitationData: ContactInvitationCreationAttributes = {
      inviterId,
      inviteeId,
      status: "pending",
      invitationToken: uuidv4(),
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const invitation = await insert_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "create",
      invitationData
    );

    console.log("✅ Contact invitation sent:", invitation);

    // Get the invitation token for email URLs
    const invitationPlain =
      invitation && typeof invitation === "object" && "get" in invitation
        ? (invitation as any).get({ plain: true })
        : invitation;

    const token =
      invitationPlain?.invitationToken || invitationData.invitationToken;
    const inviterPlain =
      inviter && typeof inviter === "object" && "get" in inviter
        ? (inviter as any).get({ plain: true })
        : inviter;
    const inviteePlain =
      invitee && typeof invitee === "object" && "get" in invitee
        ? (invitee as any).get({ plain: true })
        : invitee;

    // Send email notification to invitee
    try {
      const frontendBaseUrl =
        process.env.FRONTEND_URL || "http://localhost:3000";
      const acceptUrl = `${frontendBaseUrl}/chat-demo.html?action=accept&token=${token}`;
      const rejectUrl = `${frontendBaseUrl}/chat-demo.html?action=decline&token=${token}`;

      await sendEmail({
        to: inviteePlain.email,
        subject: `${inviterPlain.firstName} ${inviterPlain.lastName} wants to add you as a contact`,
        type: "contact_invitation",
        data: {
          inviterName: `${inviterPlain.firstName} ${inviterPlain.lastName}`,
          inviterEmail: inviterPlain.email,
          acceptUrl,
          rejectUrl,
        },
      });

      console.log("📧 Invitation email sent to:", inviteePlain.email);
    } catch (emailError) {
      console.error("❌ Failed to send invitation email:", emailError);
      // Don't fail the invitation if email fails
    }

    res.status(201).json({
      message: "Contact invitation sent successfully",
      data: invitation,
    });
  } catch (error: any) {
    console.error("❌ Error sending contact invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Accept a contact invitation
export const accept_contact_invitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const inviteeId = req.user?.id;
    const { invitationId } = req.params;

    if (!inviteeId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Find the invitation
    const invitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: {
          id: invitationId,
          inviteeId,
          status: "pending",
        },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      }
    );

    if (!invitation) {
      res
        .status(404)
        .json({ message: "Invitation not found or already processed" });
      return;
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await insert_function<ContactInvitationAttributes>(
        "ContactInvitation",
        "update",
        { status: "expired" },
        { where: { id: invitationId } }
      );
      res.status(400).json({ message: "Invitation has expired" });
      return;
    }

    // Update invitation status
    await insert_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "update",
      { status: "accepted", respondedAt: new Date() },
      { where: { id: invitationId } }
    );

    // Create contact relationship
    const contactData: ContactCreationAttributes = {
      userAId: invitation.inviterId,
      userBId: inviteeId,
      status: "active",
    };

    const contact = await insert_function<ContactAttributes>(
      "Contact",
      "create",
      contactData
    );

    console.log("✅ Contact invitation accepted:", contact);

    // Automatically create a chat between the new contacts
    try {
      console.log(
        "💬 Auto-creating chat between new contacts:",
        invitation.inviterId,
        "and",
        inviteeId
      );
      const newChat = await create_or_get_chat_internal(
        invitation.inviterId,
        inviteeId
      );
      if (newChat) {
        console.log("✅ Chat automatically created/found:", newChat.id);
      }
    } catch (chatError: any) {
      console.error(
        "❌ Failed to auto-create chat (non-critical):",
        chatError.message
      );
      // Don't fail the invitation acceptance if chat creation fails
    }

    // Send email notification to inviter about acceptance
    try {
      // Get the full invitation with relations
      const invitationWithInviter = invitation as any;
      const inviterPlain =
        invitationWithInviter.inviter &&
        typeof invitationWithInviter.inviter === "object" &&
        "get" in invitationWithInviter.inviter
          ? invitationWithInviter.inviter.get({ plain: true })
          : invitationWithInviter.inviter;

      // Get invitee (current user) information
      const invitee = await read_function<UserModelAttributes>(
        "User",
        "findOne",
        {
          where: { id: inviteeId },
          attributes: ["id", "firstName", "lastName", "email"],
        }
      );

      const inviteePlain =
        invitee && typeof invitee === "object" && "get" in invitee
          ? (invitee as any).get({ plain: true })
          : invitee;

      if (inviterPlain?.email && inviteePlain) {
        await sendEmail({
          to: inviterPlain.email,
          subject: `${inviteePlain.firstName} ${inviteePlain.lastName} accepted your contact invitation`,
          type: "invitation_response",
          data: {
            action: "accept",
            actionText: "accepted",
            responderName: `${inviteePlain.firstName} ${inviteePlain.lastName}`,
          },
        });

        console.log(
          "📧 Acceptance notification email sent to:",
          inviterPlain.email
        );
      }
    } catch (emailError) {
      console.error("❌ Failed to send acceptance email:", emailError);
      // Don't fail the acceptance if email fails
    }

    res.status(200).json({
      message: "Contact invitation accepted successfully",
      data: contact,
    });
  } catch (error: any) {
    console.error("❌ Error accepting contact invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Decline a contact invitation
export const decline_contact_invitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const inviteeId = req.user?.id;
    const { invitationId } = req.params;

    if (!inviteeId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Find and update the invitation
    const invitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: {
          id: invitationId,
          inviteeId,
          status: "pending",
        },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      }
    );

    if (!invitation) {
      res
        .status(404)
        .json({ message: "Invitation not found or already processed" });
      return;
    }

    await insert_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "update",
      { status: "declined", respondedAt: new Date() },
      { where: { id: invitationId } }
    );

    console.log("✅ Contact invitation declined");

    // Send email notification to inviter about decline
    try {
      // Get the full invitation with relations
      const invitationWithInviter = invitation as any;
      const inviterPlain =
        invitationWithInviter.inviter &&
        typeof invitationWithInviter.inviter === "object" &&
        "get" in invitationWithInviter.inviter
          ? invitationWithInviter.inviter.get({ plain: true })
          : invitationWithInviter.inviter;

      // Get invitee (current user) information
      const invitee = await read_function<UserModelAttributes>(
        "User",
        "findOne",
        {
          where: { id: inviteeId },
          attributes: ["id", "firstName", "lastName", "email"],
        }
      );

      const inviteePlain =
        invitee && typeof invitee === "object" && "get" in invitee
          ? (invitee as any).get({ plain: true })
          : invitee;

      if (inviterPlain?.email && inviteePlain) {
        await sendEmail({
          to: inviterPlain.email,
          subject: `${inviteePlain.firstName} ${inviteePlain.lastName} declined your contact invitation`,
          type: "invitation_response",
          data: {
            action: "decline",
            actionText: "declined",
            responderName: `${inviteePlain.firstName} ${inviteePlain.lastName}`,
          },
        });

        console.log(
          "📧 Decline notification email sent to:",
          inviterPlain.email
        );
      }
    } catch (emailError) {
      console.error("❌ Failed to send decline email:", emailError);
      // Don't fail the decline if email fails
    }

    res.status(200).json({
      message: "Contact invitation declined successfully",
    });
  } catch (error: any) {
    console.error("❌ Error declining contact invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get pending invitations for current user
export const get_pending_invitations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invitations = await read_function<ContactInvitationAttributes[]>(
      "ContactInvitation",
      "findAll",
      {
        where: {
          inviteeId: userId,
          status: "pending",
          expiresAt: {
            [Op.gt]: new Date(),
          },
        },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["invitedAt", "DESC"]],
      }
    );

    res.status(200).json({
      message: "Pending invitations retrieved successfully",
      data: invitations || [],
    });
  } catch (error: any) {
    console.error("❌ Error getting pending invitations:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get sent invitations
export const get_sent_invitations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invitations = await read_function<ContactInvitationAttributes[]>(
      "ContactInvitation",
      "findAll",
      {
        where: {
          inviterId: userId,
        },
        include: [
          {
            model: database_models.User,
            as: "invitee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["invitedAt", "DESC"]],
      }
    );

    res.status(200).json({
      message: "Sent invitations retrieved successfully",
      data: invitations || [],
    });
  } catch (error: any) {
    console.error("❌ Error getting sent invitations:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Verify invitation (public endpoint for email links)
export const verify_invitation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    // Find the invitation with inviter details
    const invitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: { invitationToken: token },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: database_models.User,
            as: "invitee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      }
    );

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found" });
      return;
    }

    // Check if invitation has expired
    const invitationPlain = invitation as any;
    if (new Date(invitationPlain.expiresAt) < new Date()) {
      res.status(410).json({ message: "Invitation has expired" });
      return;
    }

    res.status(200).json({
      message: "Invitation verified successfully",
      data: invitation,
    });
  } catch (error: any) {
    console.error("❌ Error verifying invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Accept invitation via token (public endpoint for email links)
export const accept_invitation_by_token = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    // Find the invitation
    const invitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: { invitationToken: token },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: database_models.User,
            as: "invitee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      }
    );

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found" });
      return;
    }

    const invitationPlain = invitation as any;

    // Check if invitation has expired
    if (new Date(invitationPlain.expiresAt) < new Date()) {
      res.status(410).json({ message: "Invitation has expired" });
      return;
    }

    // Check if already responded
    if (invitationPlain.status !== "pending") {
      res.status(400).json({
        message: `Invitation has already been ${invitationPlain.status}`,
      });
      return;
    }

    // Create contact relationship
    const contactData: ContactCreationAttributes = {
      userAId: invitationPlain.inviterId,
      userBId: invitationPlain.inviteeId,
      status: "active",
    };

    await insert_function<ContactAttributes>("Contact", "create", contactData);

    // Automatically create a chat between the new contacts
    try {
      console.log(
        "💬 Auto-creating chat between new contacts:",
        invitationPlain.inviterId,
        "and",
        invitationPlain.inviteeId
      );
      const newChat = await create_or_get_chat_internal(
        invitationPlain.inviterId,
        invitationPlain.inviteeId
      );
      if (newChat) {
        console.log("✅ Chat automatically created/found:", newChat.id);
      }
    } catch (chatError: any) {
      console.error(
        "❌ Failed to auto-create chat (non-critical):",
        chatError.message
      );
      // Don't fail the invitation acceptance if chat creation fails
    }

    // Update invitation status
    await insert_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "update",
      {
        status: "accepted",
        respondedAt: new Date(),
      } as Partial<ContactInvitationAttributes>,
      {
        where: { id: invitationPlain.id },
      }
    );

    // Send email notification to inviter
    try {
      await sendEmail({
        to: invitationPlain.inviter.email,
        subject: "Contact Invitation Accepted!",
        type: "invitation_response",
        data: {
          inviterName: invitationPlain.inviter.firstName,
          responderName: `${invitationPlain.invitee.firstName} ${invitationPlain.invitee.lastName}`,
          action: "accepted",
          appUrl: `http://localhost:5500/chat-demo.html`,
        },
      });
      console.log("✅ Acceptance email sent to inviter");
    } catch (emailError) {
      console.error("❌ Failed to send acceptance email:", emailError);
    }

    console.log("✅ Contact invitation accepted via token");

    res.status(200).json({
      message: "Invitation accepted successfully",
    });
  } catch (error: any) {
    console.error("❌ Error accepting invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Decline invitation via token (public endpoint for email links)
export const decline_invitation_by_token = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    // Find the invitation
    const invitation = await read_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "findOne",
      {
        where: { invitationToken: token },
        include: [
          {
            model: database_models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: database_models.User,
            as: "invitee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      }
    );

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found" });
      return;
    }

    const invitationPlain = invitation as any;

    // Check if invitation has expired
    if (new Date(invitationPlain.expiresAt) < new Date()) {
      res.status(410).json({ message: "Invitation has expired" });
      return;
    }

    // Check if already responded
    if (invitationPlain.status !== "pending") {
      res.status(400).json({
        message: `Invitation has already been ${invitationPlain.status}`,
      });
      return;
    }

    // Update invitation status
    await insert_function<ContactInvitationAttributes>(
      "ContactInvitation",
      "update",
      {
        status: "declined",
        respondedAt: new Date(),
      } as Partial<ContactInvitationAttributes>,
      {
        where: { id: invitationPlain.id },
      }
    );

    // Send email notification to inviter
    try {
      await sendEmail({
        to: invitationPlain.inviter.email,
        subject: "Contact Invitation Declined",
        type: "invitation_response",
        data: {
          inviterName: invitationPlain.inviter.firstName,
          responderName: `${invitationPlain.invitee.firstName} ${invitationPlain.invitee.lastName}`,
          action: "declined",
          appUrl: `http://localhost:5500/chat-demo.html`,
        },
      });
      console.log("✅ Decline email sent to inviter");
    } catch (emailError) {
      console.error("❌ Failed to send decline email:", emailError);
    }

    console.log("✅ Contact invitation declined via token");

    res.status(200).json({
      message: "Invitation declined successfully",
    });
  } catch (error: any) {
    console.error("❌ Error declining invitation:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
