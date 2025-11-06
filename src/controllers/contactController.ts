import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/requests";
import Models from "../database/models";
import {
  getUserContacts,
  getContactById,
  updateContactStatus,
  removeContact,
  searchUsers,
  createContact,
  getContactStats,
} from "../utils/contactService";

// Get all contacts for current user
const get_user_contacts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as "active" | "blocked" | undefined;

    const { contacts, totalCount } = await getUserContacts(
      req.app,
      req.user.id,
      status,
      page,
      limit
    );

    res.json({
      contacts,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get contact by ID
const get_contact_by_id = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const contact = await getContactById(req.app, id, req.user.id);

    if (!contact) {
      res.status(404).json({ message: "Contact not found" });
      return;
    }

    res.json(contact);
  } catch (error) {
    next(error);
  }
};

// Update contact status (block/unblock)
const update_contact_status = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["active", "blocked"].includes(status)) {
      res
        .status(400)
        .json({ message: "Valid status (active or blocked) is required" });
      return;
    }

    const updatedContact = await updateContactStatus(
      req.app,
      id,
      req.user.id,
      status
    );

    if (!updatedContact) {
      res.status(404).json({ message: "Contact not found" });
      return;
    }

    res.json({
      message: "Contact status updated successfully",
      data: updatedContact,
    });
  } catch (error) {
    next(error);
  }
};

// Remove a contact (delete the relationship)
const remove_contact = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const success = await removeContact(req.app, id, req.user.id);

    if (!success) {
      res.status(404).json({ message: "Contact not found" });
      return;
    }

    res.json({ message: "Contact removed successfully" });
  } catch (error) {
    next(error);
  }
};

// Search for users to potentially invite as contacts
const search_users = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== "string") {
      res.status(400).json({ message: "Search query is required" });
      return;
    }

    const users = await searchUsers(
      req.app,
      req.user.id,
      q,
      parseInt(limit as string)
    );

    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Create a new contact (for invitation acceptance or direct addition)
const create_contact = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userBId } = req.body;

    if (!userBId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    const contact = await createContact(req.app, req.user.id, userBId);

    res.status(201).json({
      message: "Contact created successfully",
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

// Get contact statistics
const get_contact_stats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await getContactStats(req.app, req.user.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export {
  get_user_contacts,
  get_contact_by_id,
  update_contact_status,
  remove_contact,
  search_users,
  create_contact,
  get_contact_stats,
  get_pending_invitations,
  get_accepted_contacts,
  get_sent_invitations,
};

// Get pending contact invitations
const get_pending_invitations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [invitations, totalCount] = await Promise.all([
      models.ContactInvitation.findAll({
        where: {
          inviteeId: userId,
          status: "pending",
        },
        include: [
          {
            model: models.User,
            as: "inviter",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["invitedAt", "DESC"]],
        limit,
        offset,
      }),
      models.ContactInvitation.count({
        where: {
          inviteeId: userId,
          status: "pending",
        },
      }),
    ]);

    const plainInvitations = invitations.map((invitation) => invitation.get({ plain: true }));

    res.json({
      invitations: plainInvitations,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get accepted contacts (active contacts)
const get_accepted_contacts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { contacts, totalCount } = await getUserContacts(
      req.app,
      req.user.id,
      "active",
      page,
      limit
    );

    res.json({
      contacts,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get sent contact invitations
const get_sent_invitations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [invitations, totalCount] = await Promise.all([
      models.ContactInvitation.findAll({
        where: {
          inviterId: userId,
        },
        include: [
          {
            model: models.User,
            as: "invitee",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["invitedAt", "DESC"]],
        limit,
        offset,
      }),
      models.ContactInvitation.count({
        where: {
          inviterId: userId,
        },
      }),
    ]);

    const plainInvitations = invitations.map((invitation) => invitation.get({ plain: true }));

    res.json({
      invitations: plainInvitations,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    next(error);
  }
};

const contactController = {
  get_user_contacts,
  get_contact_by_id,
  update_contact_status,
  remove_contact,
  search_users,
  create_contact,
  get_contact_stats,
  get_pending_invitations,
  get_accepted_contacts,
  get_sent_invitations,
};

export default contactController;