import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ContactAttributes,
  UserModelAttributes,
  ContactInvitationAttributes,
} from "../types/model";
import { Op } from "sequelize";

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}
const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
// Get all contacts for current user
export const get_user_contacts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log("🔍 Getting contacts for user:", userId);

    // Get all contacts where user is either userA or userB
    const contacts = await read_function<ContactAttributes[]>(
      "Contact",
      "findAll",
      {
        where: {
          [Op.or]: [{ userAId: userId }, { userBId: userId }],
          status: "active",
        },
        include: [
          {
            model: database_models.User,
            as: "userA",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: database_models.User,
            as: "userB",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
        order: [["createdAt", "DESC"]],
      }
    );

    // Transform the contacts to return only the other user's info
    const transformedContacts = (contacts || []).map((contact) => {
      const contactPlain = isSequelizeInstance(contact)
        ? contact.get({ plain: true })
        : contact;
      const otherUser =
        contactPlain.userAId === userId
          ? contactPlain.userB
          : contactPlain.userA;

      return {
        id: contactPlain.id,
        contactUser: otherUser,
        status: contactPlain.status,
        createdAt: contactPlain.createdAt,
      };
    });

    console.log("✅ Found contacts:", transformedContacts.length);

    res.status(200).json({
      message: "Contacts retrieved successfully",
      data: transformedContacts,
    });
  } catch (error: any) {
    console.error("❌ Error getting user contacts:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove a contact (block or delete relationship)
export const remove_contact = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { contactUserId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!contactUserId) {
      res.status(400).json({ message: "Contact user ID is required" });
      return;
    }

    // Find the contact relationship
    const contact = await read_function<ContactAttributes>(
      "Contact",
      "findOne",
      {
        where: {
          [Op.or]: [
            { userAId: userId, userBId: contactUserId },
            { userAId: contactUserId, userBId: userId },
          ],
        },
      }
    );

    if (!contact) {
      res.status(404).json({ message: "Contact relationship not found" });
      return;
    }

    // Block the contact instead of deleting (preserve chat history)
    await insert_function<ContactAttributes>(
      "Contact",
      "update",
      { status: "blocked" },
      { where: { id: contact.id } }
    );

    console.log("✅ Contact blocked successfully");

    res.status(200).json({
      message: "Contact removed successfully",
    });
  } catch (error: any) {
    console.error("❌ Error removing contact:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get current user's profile information (for sharing profile URL)
export const get_user_profile_info = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log("🔍 Getting profile info for user:", userId);

    // Get current user's information
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: userId },
      attributes: ["id", "firstName", "lastName", "email", "isVerified"],
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const userPlain = isSequelizeInstance(user)
      ? user.get({ plain: true })
      : user;

    // Generate profile URL
    const profileUrl = `${frontendBaseUrl}/welcome/${userId}`;

    console.log("✅ Profile info retrieved");

    res.status(200).json({
      message: "Profile information retrieved successfully",
      data: {
        id: userPlain.id,
        firstName: userPlain.firstName,
        lastName: userPlain.lastName,
        email: userPlain.email,
        profileUrl,
        isVerified: userPlain.isVerified,
      },
    });
  } catch (error: any) {
    console.error("❌ Error getting profile info:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if two users are contacts
export const are_users_contacts = async (
  userId1: string,
  userId2: string
): Promise<boolean> => {
  try {
    const contact = await read_function<ContactAttributes>(
      "Contact",
      "findOne",
      {
        where: {
          [Op.or]: [
            { userAId: userId1, userBId: userId2 },
            { userAId: userId2, userBId: userId1 },
          ],
          status: "active",
        },
      }
    );

    return !!contact;
  } catch (error) {
    console.error("❌ Error checking contact relationship:", error);
    return false;
  }
};
