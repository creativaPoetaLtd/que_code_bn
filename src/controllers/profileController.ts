import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import {
  ProfileModelAttributes,
} from "../types/model";
import cloudinary from "../helpers/cloudinary";
import { deleteCloudinaryFile } from "../helpers/upload";

function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

const get_profile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, organizationId } = req.query;

    if (!userId && !organizationId) {
      res.status(400).json({ message: "Either userId or organizationId is required" });
      return;
    }

    const whereClause = userId
      ? { userId: userId as string }
      : { organizationId: organizationId as string };

    const profile = await read_function<ProfileModelAttributes>(
      "Profile",
      "findOne",
      { where: whereClause }
    );

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    res.status(200).json(plainProfile);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching the profile",
      error: error.message,
    });
  }
};

const get_profile_by_id = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const profile = await read_function<ProfileModelAttributes>(
      "Profile",
      "findOne",
      { where: { id } }
    );

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    res.status(200).json(plainProfile);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching the profile",
      error: error.message,
    });
  }
};

const update_profile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      type,
      userId,
      organizationId,
      province,
      district,
      sector,
      cell,
      tinNumber,
      statusMessage,
      showPhoneOnWelcome,
      showProfileImageOnWelcome,
      showStatusMessageOnWelcome,
      qrCode,
    } = req.body;

    const existingProfile = await read_function<ProfileModelAttributes>(
      "Profile",
      "findOne",
      { where: { id } }
    );

    if (!existingProfile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const updateData: Partial<ProfileModelAttributes> = {};

    if (type !== undefined) {
      if (type === "individual" || type === "organization") {
        updateData.type = type;
      } else {
        res.status(400).json({ message: "Type must be either 'individual' or 'organization'" });
        return;
      }
    }

    if (userId !== undefined) updateData.userId = userId;
    if (organizationId !== undefined) updateData.organizationId = organizationId;

    if (province !== undefined) updateData.province = province;
    if (district !== undefined) updateData.district = district;
    if (sector !== undefined) updateData.sector = sector;
    if (cell !== undefined) updateData.cell = cell;

    if (tinNumber !== undefined) updateData.tinNumber = tinNumber;
    if (statusMessage !== undefined) updateData.statusMessage = statusMessage;
    if (qrCode !== undefined) updateData.qrCode = qrCode;

    if (showPhoneOnWelcome !== undefined) {
      updateData.showPhoneOnWelcome = typeof showPhoneOnWelcome === "string"
        ? showPhoneOnWelcome === "true"
        : Boolean(showPhoneOnWelcome);
    }
    if (showProfileImageOnWelcome !== undefined) {
      updateData.showProfileImageOnWelcome = typeof showProfileImageOnWelcome === "string"
        ? showProfileImageOnWelcome === "true"
        : Boolean(showProfileImageOnWelcome);
    }
    if (showStatusMessageOnWelcome !== undefined) {
      updateData.showStatusMessageOnWelcome = typeof showStatusMessageOnWelcome === "string"
        ? showStatusMessageOnWelcome === "true"
        : Boolean(showStatusMessageOnWelcome);
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Handle profile image upload to Cloudinary
    if (files?.profileImage?.[0]) {
      try {
        // Delete old profile image from Cloudinary if it exists
        if (existingProfile.profileImage && existingProfile.profileImage.includes('cloudinary')) {
          const publicId = existingProfile.profileImage.split('/').pop()?.split('.')[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId);
          }
        }

        // Upload new profile image to Cloudinary using file buffer
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'profiles',
              transformation: [
                { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(files.profileImage[0].buffer);
        });
        
        updateData.profileImage = (uploadResult as any).secure_url;
      } catch (uploadError: any) {
        res.status(500).json({
          message: "Failed to upload profile image to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    // Handle logo upload to Cloudinary
    if (files?.logo?.[0]) {
      try {
        // Delete old logo from Cloudinary if it exists
        if (existingProfile.logo && existingProfile.logo.includes('cloudinary')) {
          const publicId = existingProfile.logo.split('/').pop()?.split('.')[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId);
          }
        }

        // Upload new logo to Cloudinary using file buffer
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'profiles/logos',
              transformation: [
                { width: 300, height: 300, crop: 'fill' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(files.logo[0].buffer);
        });
        
        updateData.logo = (uploadResult as any).secure_url;
      } catch (uploadError: any) {
        res.status(500).json({
          message: "Failed to upload logo to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    // Handle operational document upload to Cloudinary
    if (files?.operationalDocument?.[0]) {
      try {
        // Delete old document from Cloudinary if it exists
        if (existingProfile.operationalDocument && existingProfile.operationalDocument.includes('cloudinary')) {
          const publicId = existingProfile.operationalDocument.split('/').pop()?.split('.')[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId);
          }
        }

        // Upload new document to Cloudinary using file buffer
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'profiles/documents',
              resource_type: 'auto'
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(files.operationalDocument[0].buffer);
        });
        
        updateData.operationalDocument = (uploadResult as any).secure_url;
      } catch (uploadError: any) {
        res.status(500).json({
          message: "Failed to upload operational document to Cloudinary",
          error: uploadError.message,
        });
        return;
      }
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "No fields provided for update" });
      return;
    }

    await insert_function<ProfileModelAttributes>(
      "Profile",
      "update",
      updateData,
      { where: { id } }
    );

    const refreshedProfile = await read_function<ProfileModelAttributes>(
      "Profile",
      "findOne",
      { where: { id } }
    );

    const plainProfile = isSequelizeInstance(refreshedProfile)
      ? refreshedProfile.get({ plain: true })
      : refreshedProfile;

    res.status(200).json({
      message: "Profile updated successfully",
      data: plainProfile,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while updating the profile",
      error: error.message,
    });
  }
};

const get_all_profiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const whereClause = type ? { type: type as string } : {};

    const profiles = await read_function<ProfileModelAttributes[]>(
      "Profile",
      "findAll",
      { where: whereClause }
    );

    const plainProfiles = Array.isArray(profiles)
      ? profiles.map((p) => (isSequelizeInstance(p) ? p.get({ plain: true }) : p))
      : [];

    res.status(200).json(plainProfiles);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching profiles",
      error: error.message,
    });
  }
};

export default {
  get_profile,
  get_profile_by_id,
  update_profile,
  get_all_profiles,
};
