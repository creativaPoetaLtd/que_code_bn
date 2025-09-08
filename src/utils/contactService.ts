import Models from "../database/models";
import { Application } from "express";
import { Op } from "sequelize";
import { ContactAttributes, UserModelAttributes } from "../types/model";
import { createAndSendNotification } from "./notificationService";
import { NotificationType } from "./notificationConfig";

/**
 * Get all contacts for a user with pagination and filtering
 */
export async function getUserContacts(
  app: Application,
  userId: string,
  status?: "active" | "blocked",
  page: number = 1,
  limit: number = 20
) {
  const models = app.get("models") as ReturnType<typeof Models>;
  const offset = (page - 1) * limit;

  const whereClause: any = {
    [Op.or]: [{ userAId: userId }, { userBId: userId }],
  };

  if (status) {
    whereClause.status = status;
  }

  const [contacts, totalCount] = await Promise.all([
    models.Contact.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    }),
    models.Contact.count({ where: whereClause }),
  ]);

  // Transform contacts to include the "other user" information
  const contactsWithOtherUser = await Promise.all(
    contacts.map(async (contact: any) => {
      const contactData = contact.get({ plain: true });
      const otherUserId =
        contactData.userAId === userId ? contactData.userBId : contactData.userAId;

      const otherUser = await models.User.findByPk(otherUserId, {
        attributes: ["id", "firstName", "lastName", "email"],
      });

      return {
        ...contactData,
        otherUser: otherUser ? otherUser.get({ plain: true }) : null,
      };
    })
  );

  return { contacts: contactsWithOtherUser, totalCount };
}

/**
 * Get a specific contact by ID for a user
 */
export async function getContactById(
  app: Application,
  contactId: string,
  userId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;

  const contact = await models.Contact.findOne({
    where: {
      id: contactId,
      [Op.or]: [{ userAId: userId }, { userBId: userId }],
    },
  });

  if (!contact) {
    return null;
  }

  const contactData = contact.get({ plain: true });
  const otherUserId =
    contactData.userAId === userId ? contactData.userBId : contactData.userAId;

  const otherUser = await models.User.findByPk(otherUserId, {
    attributes: ["id", "firstName", "lastName", "email"],
  });

  return {
    ...contactData,
    otherUser: otherUser ? otherUser.get({ plain: true }) : null,
  };
}

/**
 * Update contact status (block/unblock)
 */
export async function updateContactStatus(
  app: Application,
  contactId: string,
  userId: string,
  status: "active" | "blocked"
) {
  const models = app.get("models") as ReturnType<typeof Models>;

  const contact = await models.Contact.findOne({
    where: {
      id: contactId,
      [Op.or]: [{ userAId: userId }, { userBId: userId }],
    },
  });

  if (!contact) {
    return null;
  }

  contact.status = status;
  await contact.save();

  // Get the other user ID for notification
  const contactData = contact.get({ plain: true });
  const otherUserId =
    contactData.userAId === userId ? contactData.userBId : contactData.userAId;

  // Get current user's name for notification
  const currentUser = await models.User.findByPk(userId, {
    attributes: ["firstName", "lastName"],
  });

  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : "Someone";

  // Send notification to the other user
  if (status === "blocked") {
    await createAndSendNotification(app, {
      type: NotificationType.CONTACT_BLOCKED,
      recipientId: otherUserId,
      data: {
        userId,
        userName,
        contactId,
        title: "Contact Blocked",
        message: `${userName} has blocked you`,
      },
    });
  } else if (status === "active") {
    await createAndSendNotification(app, {
      type: NotificationType.CONTACT_UNBLOCKED,
      recipientId: otherUserId,
      data: {
        userId,
        userName,
        contactId,
        title: "Contact Unblocked",
        message: `${userName} has unblocked you`,
      },
    });
  }

  return contact.get({ plain: true });
}

/**
 * Remove/delete a contact
 */
export async function removeContact(
  app: Application,
  contactId: string,
  userId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;

  const contact = await models.Contact.findOne({
    where: {
      id: contactId,
      [Op.or]: [{ userAId: userId }, { userBId: userId }],
    },
  });

  if (!contact) {
    return false;
  }

  // Get the other user ID for notification
  const contactData = contact.get({ plain: true });
  const otherUserId =
    contactData.userAId === userId ? contactData.userBId : contactData.userAId;

  // Get current user's name for notification
  const currentUser = await models.User.findByPk(userId, {
    attributes: ["firstName", "lastName"],
  });

  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : "Someone";

  // Delete the contact
  await contact.destroy();

  // Send notification to the other user
  await createAndSendNotification(app, {
    type: NotificationType.CONTACT_REMOVED,
    recipientId: otherUserId,
    data: {
      userId,
      userName,
      title: "Contact Removed",
      message: `${userName} has removed you from their contacts`,
    },
  });

  return true;
}

/**
 * Search for users to potentially add as contacts
 */
export async function searchUsers(
  app: Application,
  userId: string,
  query: string,
  limit: number = 10
) {
  const models = app.get("models") as ReturnType<typeof Models>;

  // Search for users excluding current user
  const users = await models.User.findAll({
    where: {
      id: { [Op.ne]: userId },
      [Op.or]: [
        { firstName: { [Op.iLike]: `%${query}%` } },
        { lastName: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } },
      ],
    },
    attributes: ["id", "firstName", "lastName", "email"],
    limit,
  });

  // Check relationship status for each user
  const usersWithStatus = await Promise.all(
    users.map(async (user: any) => {
      const userData = user.get({ plain: true });

      // Check if already a contact
      const existingContact = await models.Contact.findOne({
        where: {
          [Op.or]: [
            { userAId: userId, userBId: userData.id },
            { userAId: userData.id, userBId: userId },
          ],
        },
      });

      // Check if there's a pending invitation
      const pendingInvitation = await models.ContactInvitation.findOne({
        where: {
          [Op.or]: [
            { inviterId: userId, inviteeId: userData.id, status: "pending" },
            { inviterId: userData.id, inviteeId: userId, status: "pending" },
          ],
        },
      });

      let relationshipStatus = "none";
      if (existingContact) {
        const contactData = existingContact.get({ plain: true });
        relationshipStatus = contactData.status; // active or blocked
      } else if (pendingInvitation) {
        relationshipStatus = "pending_invitation";
      }

      return {
        ...userData,
        relationshipStatus,
      };
    })
  );

  return usersWithStatus;
}

/**
 * Create a new contact relationship
 */
export async function createContact(
  app: Application,
  userAId: string,
  userBId: string
) {
  const models = app.get("models") as ReturnType<typeof Models>;

  // Check if contact already exists
  const existingContact = await models.Contact.findOne({
    where: {
      [Op.or]: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
  });

  if (existingContact) {
    return existingContact.get({ plain: true });
  }

  // Create new contact
  const contact = await models.Contact.create({
    userAId,
    userBId,
    status: "active",
  });

  // Get user names for notifications
  const [userA, userB] = await Promise.all([
    models.User.findByPk(userAId, {
      attributes: ["firstName", "lastName"],
    }),
    models.User.findByPk(userBId, {
      attributes: ["firstName", "lastName"],
    }),
  ]);

  const userAName = userA
    ? `${userA.firstName} ${userA.lastName}`
    : "Someone";
  const userBName = userB
    ? `${userB.firstName} ${userB.lastName}`
    : "Someone";

  // Send notifications to both users
  await Promise.all([
    createAndSendNotification(app, {
      type: NotificationType.CONTACT_ADDED,
      recipientId: userBId,
      data: {
        userId: userAId,
        userName: userAName,
        contactId: contact.id,
        title: "New Contact Added",
        message: `${userAName} added you as a contact`,
      },
    }),
    createAndSendNotification(app, {
      type: NotificationType.CONTACT_ADDED,
      recipientId: userAId,
      data: {
        userId: userBId,
        userName: userBName,
        contactId: contact.id,
        title: "New Contact Added",
        message: `You are now connected with ${userBName}`,
      },
    }),
  ]);

  return contact.get({ plain: true });
}

/**
 * Get contact statistics for a user
 */
export async function getContactStats(app: Application, userId: string) {
  const models = app.get("models") as ReturnType<typeof Models>;

  const [total, active, blocked] = await Promise.all([
    models.Contact.count({
      where: {
        [Op.or]: [{ userAId: userId }, { userBId: userId }],
      },
    }),
    models.Contact.count({
      where: {
        [Op.or]: [{ userAId: userId }, { userBId: userId }],
        status: "active",
      },
    }),
    models.Contact.count({
      where: {
        [Op.or]: [{ userAId: userId }, { userBId: userId }],
        status: "blocked",
      },
    }),
  ]);

  return {
    total,
    active,
    blocked,
  };
}
