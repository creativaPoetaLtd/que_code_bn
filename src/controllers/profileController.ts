import { Request, Response } from "express";
import { Op } from "sequelize";
import { insert_function, read_function } from "../utils/db_methods";
import database_models from "../database/config/db.config";
import {
  ProfileModelAttributes,
} from "../types/model";
import cloudinary from "../helpers/cloudinary";
import { deleteCloudinaryFile } from "../helpers/upload";
import { notifyProfileUpdated } from "../utils/notificationHelpers";

type SocialLinkKey = "instagram" | "facebook" | "twitter" | "linkedin";

const SOCIAL_LINK_KEYS: SocialLinkKey[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
];

function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getOperationalDocumentExposure = (req: Request): boolean => {
  return Boolean((req as any).user);
};

const formatProfileResponse = (
  profile: any,
  exposeOperationalDocument: boolean
) => {
  const response = {
    ...profile,
    socialLinks: {
      instagram: profile.instagram || "",
      facebook: profile.facebook || "",
      twitter: profile.twitter || "",
      linkedin: profile.linkedin || "",
    },
  } as any;

  if (!exposeOperationalDocument) {
    delete response.operationalDocument;
  }

  return response;
};

const parseSocialLinksInput = (
  body: any
): { updates: Partial<ProfileModelAttributes>; error?: string } => {
  const updates: Partial<ProfileModelAttributes> = {};
  let nestedLinks = body.socialLinks;

  if (typeof nestedLinks === "string") {
    try {
      nestedLinks = JSON.parse(nestedLinks);
    } catch {
      return {
        updates,
        error: "socialLinks must be a valid JSON object",
      };
    }
  }

  for (const key of SOCIAL_LINK_KEYS) {
    const directValue = body[key];
    const nestedValue = nestedLinks?.[key];
    const rawValue = directValue !== undefined ? directValue : nestedValue;

    if (rawValue === undefined) {
      continue;
    }

    const trimmed = String(rawValue).trim();
    if (!trimmed) {
      (updates as any)[key] = null;
      continue;
    }

    if (!isValidUrl(trimmed)) {
      return {
        updates,
        error: `${key} must be a valid URL starting with http:// or https://`,
      };
    }

    (updates as any)[key] = trimmed;
  }

  return { updates };
};

const toIsoString = (dateValue: any): string => {
  if (!dateValue) {
    return new Date(0).toISOString();
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const uploadGalleryImageToCloudinary = async (file: Express.Multer.File) => {
  let uploadResult: unknown;

  if ((file as any).buffer && (file as any).buffer.length > 0) {
    uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "gallery/profiles",
          transformation: [{ quality: "auto" }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end((file as any).buffer);
    });
  } else if ((file as any).path) {
    uploadResult = await cloudinary.uploader.upload((file as any).path, {
      folder: "gallery/profiles",
      transformation: [{ quality: "auto" }],
    });
  } else {
    throw new Error("Empty file");
  }

  return (uploadResult as any).secure_url as string;
};

const findProfileForGallery = async (id: string) => {
  const profile = await read_function<ProfileModelAttributes>(
    "Profile",
    "findOne",
    {
      where: {
        [Op.or]: [{ userId: id }, { organizationId: id }],
      },
    }
  );

  return profile;
};

const extractCloudinaryPublicId = (imageUrl: string): string | null => {
  if (!imageUrl || !imageUrl.includes("cloudinary")) {
    return null;
  }

  const fileName = imageUrl.split("/").pop();
  if (!fileName) {
    return null;
  }

  const withoutExtension = fileName.split(".")[0];
  const parts = imageUrl.split("/upload/");
  if (parts.length < 2) {
    return withoutExtension;
  }

  const pathAfterUpload = parts[1].replace(/^v\d+\//, "");
  const pathParts = pathAfterUpload.split("/");
  pathParts[pathParts.length - 1] = withoutExtension;
  return pathParts.join("/");
};

const deleteGalleryImageFromCloudinary = async (imageUrl: string) => {
  const publicId = extractCloudinaryPublicId(imageUrl);
  if (publicId) {
    await cloudinary.uploader.destroy(publicId);
  }
};

const get_profile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, organizationId } = req.query;

    if (!userId && !organizationId) {
      res.status(400).json({ message: "Either userId or organizationId is required" });
      return;
    }

    // Build where clause to handle both parameters with OR logic
    let whereClause: any;
    
    if (userId && organizationId) {
      // If both are provided, search for profile that matches either userId OR organizationId
      whereClause = {
        [Op.or]: [
          { userId: userId as string },
          { organizationId: organizationId as string }
        ]
      };
    } else if (userId) {
      whereClause = { userId: userId as string };
    } else if (organizationId) {
      whereClause = { organizationId: organizationId as string };
    }

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

    const exposeOperationalDocument = getOperationalDocumentExposure(req);

    res.status(200).json(formatProfileResponse(plainProfile, exposeOperationalDocument));
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

    const exposeOperationalDocument = getOperationalDocumentExposure(req);

    res.status(200).json(formatProfileResponse(plainProfile, exposeOperationalDocument));
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
      instagram,
      facebook,
      twitter,
      linkedin,
      socialLinks,
      province,
      district,
      sector,
      cell,
      tinNumber,
      statusMessage,
      showPhoneOnWelcome,
      showProfileImageOnWelcome,
      showStatusMessageOnWelcome,
      showProfileTypeOnWelcome,
      showLocationOnWelcome,
      showTinOnWelcome,
      showLogoOnWelcome,
      showCategoryOnWelcome,
      showSocialLinksOnWelcome,
      showGalleryOnWelcome,
      showOrgStatsOnWelcome,
      showActionsOnWelcome,
      showSendMoneyOnWelcome,
      showContactFormOnWelcome,
      showOtherInfoOnWelcome,
      showFriendRequestOnWelcome,
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

    const socialLinkUpdate = parseSocialLinksInput({
      ...req.body,
      instagram,
      facebook,
      twitter,
      linkedin,
      socialLinks,
    });

    if (socialLinkUpdate.error) {
      res.status(400).json({ message: socialLinkUpdate.error });
      return;
    }

    Object.assign(updateData, socialLinkUpdate.updates);

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
    if (showProfileTypeOnWelcome !== undefined) {
      updateData.showProfileTypeOnWelcome = typeof showProfileTypeOnWelcome === "string"
        ? showProfileTypeOnWelcome === "true"
        : Boolean(showProfileTypeOnWelcome);
    }
    if (showLocationOnWelcome !== undefined) {
      updateData.showLocationOnWelcome = typeof showLocationOnWelcome === "string"
        ? showLocationOnWelcome === "true"
        : Boolean(showLocationOnWelcome);
    }
    if (showTinOnWelcome !== undefined) {
      updateData.showTinOnWelcome = typeof showTinOnWelcome === "string"
        ? showTinOnWelcome === "true"
        : Boolean(showTinOnWelcome);
    }
    if (showLogoOnWelcome !== undefined) {
      updateData.showLogoOnWelcome = typeof showLogoOnWelcome === "string"
        ? showLogoOnWelcome === "true"
        : Boolean(showLogoOnWelcome);
    }
    if (showCategoryOnWelcome !== undefined) {
      updateData.showCategoryOnWelcome = typeof showCategoryOnWelcome === "string"
        ? showCategoryOnWelcome === "true"
        : Boolean(showCategoryOnWelcome);
    }
    if (showSocialLinksOnWelcome !== undefined) {
      updateData.showSocialLinksOnWelcome = typeof showSocialLinksOnWelcome === "string"
        ? showSocialLinksOnWelcome === "true"
        : Boolean(showSocialLinksOnWelcome);
    }
    if (showGalleryOnWelcome !== undefined) {
      updateData.showGalleryOnWelcome = typeof showGalleryOnWelcome === "string"
        ? showGalleryOnWelcome === "true"
        : Boolean(showGalleryOnWelcome);
    }
    if (showOrgStatsOnWelcome !== undefined) {
      updateData.showOrgStatsOnWelcome = typeof showOrgStatsOnWelcome === "string"
        ? showOrgStatsOnWelcome === "true"
        : Boolean(showOrgStatsOnWelcome);
    }
    if (showActionsOnWelcome !== undefined) {
      updateData.showActionsOnWelcome = typeof showActionsOnWelcome === "string"
        ? showActionsOnWelcome === "true"
        : Boolean(showActionsOnWelcome);
    }
    if (showSendMoneyOnWelcome !== undefined) {
      updateData.showSendMoneyOnWelcome = typeof showSendMoneyOnWelcome === "string"
        ? showSendMoneyOnWelcome === "true"
        : Boolean(showSendMoneyOnWelcome);
    }
    if (showContactFormOnWelcome !== undefined) {
      updateData.showContactFormOnWelcome = typeof showContactFormOnWelcome === "string"
        ? showContactFormOnWelcome === "true"
        : Boolean(showContactFormOnWelcome);
    }
    if (showOtherInfoOnWelcome !== undefined) {
      updateData.showOtherInfoOnWelcome = typeof showOtherInfoOnWelcome === "string"
        ? showOtherInfoOnWelcome === "true"
        : Boolean(showOtherInfoOnWelcome);
    }
    if (showFriendRequestOnWelcome !== undefined) {
      updateData.showFriendRequestOnWelcome = typeof showFriendRequestOnWelcome === "string"
        ? showFriendRequestOnWelcome === "true"
        : Boolean(showFriendRequestOnWelcome);
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

        const profileFile = files.profileImage[0];

        // Upload new profile image to Cloudinary using file buffer or file path
        let uploadResult: unknown;
        if ((profileFile as any).buffer && (profileFile as any).buffer.length > 0) {
          uploadResult = await new Promise((resolve, reject) => {
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
            stream.end((profileFile as any).buffer);
          });
        } else if ((profileFile as any).path) {
          uploadResult = await cloudinary.uploader.upload((profileFile as any).path, {
            folder: 'profiles',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }
        
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

        const logoFile = files.logo[0];

        // Upload new logo to Cloudinary using file buffer or file path
        let uploadResult: unknown;
        if ((logoFile as any).buffer && (logoFile as any).buffer.length > 0) {
          uploadResult = await new Promise((resolve, reject) => {
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
            stream.end((logoFile as any).buffer);
          });
        } else if ((logoFile as any).path) {
          uploadResult = await cloudinary.uploader.upload((logoFile as any).path, {
            folder: 'profiles/logos',
            transformation: [
              { width: 300, height: 300, crop: 'fill' },
              { quality: 'auto' }
            ]
          });
        } else {
          throw new Error('Empty file');
        }
        
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

        const docFile = files.operationalDocument[0];

        // Upload new document to Cloudinary using file buffer or file path
        let uploadResult: unknown;
        if ((docFile as any).buffer && (docFile as any).buffer.length > 0) {
          uploadResult = await new Promise((resolve, reject) => {
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
            stream.end((docFile as any).buffer);
          });
        } else if ((docFile as any).path) {
          uploadResult = await cloudinary.uploader.upload((docFile as any).path, {
            folder: 'profiles/documents',
            resource_type: 'auto'
          });
        } else {
          throw new Error('Empty file');
        }
        
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

    // Send profile updated notification
    try {
      if (plainProfile.userId) {
        // Get user details for the notification
        const user = await read_function("User", "findOne", {
          where: { id: plainProfile.userId }
        });

        if (user) {
          const plainUser = isSequelizeInstance(user) ? user.get({ plain: true }) : user;
          const updatedFields = Object.keys(updateData);

          await notifyProfileUpdated(
            req.app,
            plainProfile.userId,
            `${plainUser.firstName} ${plainUser.lastName}`,
            updatedFields
          );
        }
      }
    } catch (notificationError) {
      console.error("❌ Failed to send profile updated notification:", notificationError);
    }

    const exposeOperationalDocument = getOperationalDocumentExposure(req);

    res.status(200).json({
      message: "Profile updated successfully",
      data: formatProfileResponse(plainProfile, exposeOperationalDocument),
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

    const exposeOperationalDocument = getOperationalDocumentExposure(req);

    res.status(200).json(
      plainProfiles.map((profile) =>
        formatProfileResponse(profile, exposeOperationalDocument)
      )
    );
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching profiles",
      error: error.message,
    });
  }
};

const get_profile_gallery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const profile = await findProfileForGallery(userId);

    if (!profile) {
      res.status(200).json({ items: [] });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    const galleryWhere = plainProfile.userId
      ? { userId: plainProfile.userId }
      : { organizationId: plainProfile.organizationId };

    const uploadedGalleryItems = await database_models.GalleryItem.findAll({
      where: galleryWhere,
      attributes: ["id", "imageUrl", "caption", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    const items: Array<{
      id: string;
      imageUrl: string;
      caption: string;
      createdAt: string;
    }> = [];

    for (const galleryItemRow of uploadedGalleryItems) {
      const galleryItem = isSequelizeInstance(galleryItemRow)
        ? galleryItemRow.get({ plain: true })
        : galleryItemRow;

      items.push({
        id: galleryItem.id,
        imageUrl: galleryItem.imageUrl,
        caption: galleryItem.caption || "Gallery image",
        createdAt: toIsoString(galleryItem.createdAt),
      });
    }

    if (plainProfile.profileImage) {
      items.push({
        id: `${plainProfile.id}-profile-image`,
        imageUrl: plainProfile.profileImage,
        caption: "Profile image",
        createdAt: toIsoString(plainProfile.updatedAt || plainProfile.createdAt),
      });
    }

    if (plainProfile.logo) {
      items.push({
        id: `${plainProfile.id}-logo`,
        imageUrl: plainProfile.logo,
        caption: "Logo",
        createdAt: toIsoString(plainProfile.updatedAt || plainProfile.createdAt),
      });
    }

    if (plainProfile.organizationId) {
      const actions = await database_models.Action.findAll({
        where: {
          organizationId: plainProfile.organizationId,
          status: "published",
          visibility: { mode: "public" },
        },
        include: [
          {
            model: database_models.SubAction,
            as: "subActions",
            required: false,
            where: {
              isActive: true,
              coverImage: { [Op.ne]: null },
            },
            attributes: ["id", "name", "coverImage", "createdAt"],
          },
        ],
        attributes: ["id", "name", "coverImage", "createdAt"],
        order: [["createdAt", "DESC"]],
      });

      for (const actionRow of actions) {
        const action: any = isSequelizeInstance(actionRow)
          ? actionRow.get({ plain: true })
          : actionRow;

        if (action.coverImage) {
          items.push({
            id: action.id,
            imageUrl: action.coverImage,
            caption: action.name || "Action",
            createdAt: toIsoString(action.createdAt),
          });
        }

        const subActions = Array.isArray(action.subActions)
          ? action.subActions
          : [];

        for (const subAction of subActions) {
          if (!subAction.coverImage) {
            continue;
          }

          items.push({
            id: subAction.id,
            imageUrl: subAction.coverImage,
            caption: subAction.name || action.name || "Sub-action",
            createdAt: toIsoString(subAction.createdAt),
          });
        }
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({ items });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching profile gallery",
      error: error.message,
    });
  }
};

const upload_profile_gallery_item = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const authUser = (req as any).user;

    if (!authUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const profile = await findProfileForGallery(userId);

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    const canUpload = authUser.isAdmin
      || (plainProfile.userId && authUser.accountType === "user" && authUser.id === plainProfile.userId)
      || (plainProfile.organizationId && authUser.organizationId === plainProfile.organizationId);

    if (!canUpload) {
      res.status(403).json({
        message: "You are not authorized to upload gallery items for this profile",
      });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: "Image file is required" });
      return;
    }

    const imageUrl = await uploadGalleryImageToCloudinary(file);
    const caption = req.body.caption ? String(req.body.caption).trim() : "";

    const galleryPayload = plainProfile.userId
      ? { userId: plainProfile.userId }
      : { organizationId: plainProfile.organizationId };

    const createdItem = await database_models.GalleryItem.create({
      ...galleryPayload,
      imageUrl,
      caption: caption || undefined,
    });

    const plainItem = isSequelizeInstance(createdItem)
      ? createdItem.get({ plain: true })
      : createdItem;

    res.status(201).json({
      message: "Gallery image uploaded successfully",
      item: {
        id: plainItem.id,
        imageUrl: plainItem.imageUrl,
        caption: plainItem.caption || "",
        createdAt: toIsoString(plainItem.createdAt),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while uploading gallery image",
      error: error.message,
    });
  }
};

const update_profile_gallery_item = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, itemId } = req.params;
    const authUser = (req as any).user;

    if (!authUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const profile = await findProfileForGallery(userId);

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    const canManage = authUser.isAdmin
      || (plainProfile.userId && authUser.accountType === "user" && authUser.id === plainProfile.userId)
      || (plainProfile.organizationId && authUser.organizationId === plainProfile.organizationId);

    if (!canManage) {
      res.status(403).json({
        message: "You are not authorized to update this gallery item",
      });
      return;
    }

    const galleryWhere = plainProfile.userId
      ? { userId: plainProfile.userId }
      : { organizationId: plainProfile.organizationId };

    const galleryItem = await database_models.GalleryItem.findOne({
      where: {
        id: itemId,
        ...galleryWhere,
      },
    });

    if (!galleryItem) {
      res.status(404).json({ message: "Gallery item not found" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const caption = req.body.caption !== undefined
      ? String(req.body.caption).trim()
      : undefined;

    const updateData: { imageUrl?: string; caption?: string } = {};

    if (file) {
      const newImageUrl = await uploadGalleryImageToCloudinary(file);
      await deleteGalleryImageFromCloudinary((galleryItem as any).imageUrl);
      updateData.imageUrl = newImageUrl;
    }

    if (caption !== undefined) {
      updateData.caption = caption;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "No fields provided for update" });
      return;
    }

    await galleryItem.update(updateData);

    const plainItem = galleryItem.get({ plain: true });

    res.status(200).json({
      message: "Gallery item updated successfully",
      item: {
        id: plainItem.id,
        imageUrl: plainItem.imageUrl,
        caption: plainItem.caption || "",
        createdAt: toIsoString(plainItem.createdAt),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while updating gallery image",
      error: error.message,
    });
  }
};

const delete_profile_gallery_item = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, itemId } = req.params;
    const authUser = (req as any).user;

    if (!authUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const profile = await findProfileForGallery(userId);

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const plainProfile = isSequelizeInstance(profile)
      ? profile.get({ plain: true })
      : profile;

    const canManage = authUser.isAdmin
      || (plainProfile.userId && authUser.accountType === "user" && authUser.id === plainProfile.userId)
      || (plainProfile.organizationId && authUser.organizationId === plainProfile.organizationId);

    if (!canManage) {
      res.status(403).json({
        message: "You are not authorized to delete this gallery item",
      });
      return;
    }

    const galleryWhere = plainProfile.userId
      ? { userId: plainProfile.userId }
      : { organizationId: plainProfile.organizationId };

    const galleryItem = await database_models.GalleryItem.findOne({
      where: {
        id: itemId,
        ...galleryWhere,
      },
    });

    if (!galleryItem) {
      res.status(404).json({ message: "Gallery item not found" });
      return;
    }

    await deleteGalleryImageFromCloudinary((galleryItem as any).imageUrl);
    await galleryItem.destroy();

    res.status(200).json({ message: "Gallery item deleted successfully" });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while deleting gallery image",
      error: error.message,
    });
  }
};

export default {
  get_profile,
  get_profile_by_id,
  update_profile,
  get_all_profiles,
  get_profile_gallery,
  upload_profile_gallery_item,
  update_profile_gallery_item,
  delete_profile_gallery_item,
};
