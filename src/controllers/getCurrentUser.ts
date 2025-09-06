import { Request, Response } from "express";
import { read_function } from "../utils/db_methods";
import { UserModelAttributes, ProfileModelAttributes } from "../types/model";

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

// Get current user details from the authenticated request
export const get_current_user = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res
        .status(401)
        .json({ message: "Unauthorized: No user ID found in token" });
      return;
    }

    console.log(`🔍 Fetching current user: ${userId}`);

    // Get user details
    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { id: userId },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "phone",
        "isVerified",
        "approvalStatus",
      ],
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Convert Sequelize instance to plain object if needed
    const userData = isSequelizeInstance(user)
      ? user.get({ plain: true })
      : user;

    // Get profile if it exists (optional)
    const profile = await read_function<ProfileModelAttributes>(
      "Profile",
      "findOne",
      {
        where: { userId },
      }
    );

    // Return user data with profile if exists
    if (profile) {
      const profileData = isSequelizeInstance(profile)
        ? profile.get({ plain: true })
        : profile;
      res.status(200).json({
        id: userData.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        isVerified: userData.isVerified,
        approvalStatus: userData.approvalStatus,
        profile: profileData,
      });
    } else {
      res.status(200).json(userData);
    }
  } catch (error) {
    console.error("❌ Error fetching current user:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the user" });
  }
};
