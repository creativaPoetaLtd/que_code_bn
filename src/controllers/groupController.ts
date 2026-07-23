import { Response, NextFunction, Application } from "express";
import { v4 as uuidv4 } from "uuid";
import { Op, literal } from "sequelize";
import QRCode from 'qrcode';
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";

import {
    CreateGroupRequest,
    InviteToGroupRequest,
    RespondToGroupInvitationRequest,
    JoinGroupByLinkRequest,
    UpdateGroupRequest,
    RequestToJoinGroupRequest,
    GroupMemberRole,
    GroupMemberStatus,
    GroupPrivacyType,
    GroupExpirationType
} from "../types/group";
import sendEmail from "../helpers/email";
import { NotificationType } from "../utils/notificationConfig";
import { createAndSendNotification, markNotificationAsRead, getUserNotifications } from "../utils/notificationService";
import {
    notifyGroupInvitationAccepted,
    notifyGroupInvitationRejected,
    notifyGroupUpdated,
    notifyGroupMemberAdded,
    notifyGroupMemberRemoved
} from "../utils/notificationHelpers";
import CloudinaryService from "../services/cloudinaryService";

const createGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            name,
            description,
            picture,
            isPrivate = false,
            privacyType = GroupPrivacyType.REQUIRE_APPROVAL,
            maxMembers = 100,
            memberIds = [],
            adminId,
            hasFundraising = false,
            fundraisingTarget,
            expirationDate,
            expirationType = GroupExpirationType.NEVER,
            hasAdditionalInfo = false,
            additionalInfoPrompt
        }: CreateGroupRequest = req.body;
        const ownerId = req.user.id;

        // Validate required fields
        if (!name || name.trim().length < 2) {
            res.status(400).json({ message: "Group name is required and must be at least 2 characters" });
            return;
        }

        // Validate fundraising data
        if (hasFundraising && !fundraisingTarget) {
            res.status(400).json({ message: "Fundraising target is required when fundraising is enabled" });
            return;
        }

        // Validate expiration data
        if (expirationType === GroupExpirationType.CUSTOM_DATE && !expirationDate) {
            res.status(400).json({ message: "Expiration date is required for custom date expiration" });
            return;
        }


        if (adminId && adminId !== ownerId && !memberIds.includes(adminId)) {
            res.status(400).json({ message: "Selected admin must be the owner or included in the member list" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Validate admin exists in contacts if provided (only if admin is not the owner)
        if (adminId && adminId !== ownerId) {
            const adminContact = await models.Contact.findOne({
                where: {
                    [Op.or]: [
                        { userAId: ownerId, userBId: adminId },
                        { userAId: adminId, userBId: ownerId }
                    ],
                    status: 'active'
                }
            });

            if (!adminContact) {
                res.status(400).json({ message: "Selected admin must be in your contacts" });
                return;
            }
        }

        const accessToken = uuidv4();
        const accessLink = `${process.env.FRONTEND_URL}/groups/join?token=${accessToken}`;

        // Generate QR code before creating the group
        let qrCodeData: string | undefined;
        try {
            qrCodeData = await QRCode.toDataURL(accessLink);
            console.log('Generated QR code before group creation, length:', qrCodeData?.length);
        } catch (qrError) {
            console.error("Failed to generate QR code:", qrError);
        }

        // Handle profile picture upload
        let profilePictureUrl: string | undefined;
        let profilePicturePublicId: string | undefined;

        if (req.file) {
            try {
                const fileName = CloudinaryService.generateFileName(`group_${name.replace(/[^a-zA-Z0-9]/g, '_')}`);
                const uploadResult = await CloudinaryService.uploadImage(req.file.buffer, 'group-profiles', fileName);
                profilePictureUrl = uploadResult.url;
                profilePicturePublicId = uploadResult.publicId;
            } catch (uploadError) {
                console.error("Failed to upload profile picture:", uploadError);
                res.status(400).json({ message: "Failed to upload profile picture" });
                return;
            }
        } else if (picture) {
            // Handle base64 image upload
            try {
                const fileName = CloudinaryService.generateFileName(`group_${name.replace(/[^a-zA-Z0-9]/g, '_')}`);
                const uploadResult = await CloudinaryService.uploadBase64Image(picture, 'group-profiles', fileName);
                profilePictureUrl = uploadResult.url;
                profilePicturePublicId = uploadResult.publicId;
            } catch (uploadError) {
                console.error("Failed to upload base64 image:", uploadError);
                res.status(400).json({ message: "Failed to upload profile picture" });
                return;
            }
        }

        const group = await models.Group.create({
            name: name.trim(),
            description: description?.trim(),
            picture: profilePictureUrl || picture,
            profilePictureUrl,
            profilePicturePublicId,
            ownerId,
            adminId: adminId || ownerId, // Default admin to owner if not specified
            accessToken,
            accessLink,
            qrCode: qrCodeData, // Include QR code in initial creation
            isPrivate,
            privacyType,
            maxMembers,
            hasFundraising,
            fundraisingTarget: hasFundraising ? fundraisingTarget : undefined,
            expirationDate: expirationType === GroupExpirationType.CUSTOM_DATE ? expirationDate : undefined,
            expirationType,
            hasAdditionalInfo,
            additionalInfoPrompt: hasAdditionalInfo ? additionalInfoPrompt : undefined
        });

        console.log('Group created with QR code:', !!group.qrCode, 'Length:', group.qrCode?.length);

        // Create wallet for fundraising groups
        let walletId: string | undefined;
        if (hasFundraising) {
            const wallet = await models.Wallet.create({
                groupId: group.id,
                balance: 0
            });
            walletId = wallet.id;
            await group.update({ walletId: wallet.id });
            console.log('Created fundraising wallet for group:', wallet.id);
        }

        // Create owner membership
        await models.GroupMember.create({
            groupId: group.id,
            userId: ownerId,
            role: GroupMemberRole.OWNER,
            status: GroupMemberStatus.ACTIVE,
            invitedBy: ownerId,
            joinedAt: new Date(),
            invitedAt: new Date(),
            autoApproved: true
        });

        // Create admin membership if different from owner
        if (adminId && adminId !== ownerId) {
            await models.GroupMember.create({
                groupId: group.id,
                userId: adminId,
                role: GroupMemberRole.ADMIN,
                status: privacyType === GroupPrivacyType.PUBLIC ? GroupMemberStatus.ACTIVE : GroupMemberStatus.PENDING,
                invitedBy: ownerId,
                joinedAt: privacyType === GroupPrivacyType.PUBLIC ? new Date() : undefined,
                invitedAt: new Date(),
                autoApproved: privacyType === GroupPrivacyType.PUBLIC
            });
        }

        // Send invitations with notifications
        if (memberIds.length > 0) {
            await inviteUsersToGroup(group.id, memberIds, ownerId, models, req.app);
        }

        const owner = await models.User.findByPk(ownerId);

        // Send notification to group owner
        await createAndSendNotification(req.app, {
            type: NotificationType.GROUP_CREATED,
            recipientId: ownerId,
            data: {
                groupId: group.id,
                groupName: group.name,
                message: `You created the group '${group.name}' successfully.`
            }
        });

        res.status(201).json({
            message: "Group created successfully",
            data: {
                id: group.id,
                name: group.name,
                description: group.description,
                picture: group.picture,
                profilePictureUrl: group.profilePictureUrl,
                ownerId: group.ownerId,
                adminId: group.adminId,
                ownerName: owner ? `${owner.firstName} ${owner.lastName}` : undefined,
                qrCode: group.qrCode,
                accessLink: group.accessLink,
                isPrivate: group.isPrivate,
                privacyType: group.privacyType,
                maxMembers: group.maxMembers,
                memberCount: group.memberCount,
                hasFundraising: group.hasFundraising,
                fundraisingTarget: group.fundraisingTarget,
                fundraisingCurrentAmount: group.fundraisingCurrentAmount,
                expirationDate: group.expirationDate,
                expirationType: group.expirationType,
                hasAdditionalInfo: group.hasAdditionalInfo,
                additionalInfoPrompt: group.additionalInfoPrompt,
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
                userRole: GroupMemberRole.OWNER,
                userStatus: GroupMemberStatus.ACTIVE
            }
        });
    } catch (error) {
        console.error("Create group error:", error);
        next(error);
    }
};

const inviteToGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId, memberIds }: { groupId: string; memberIds: string[] } = req.body;
        const inviterId = req.user.id;

        if (!groupId || !memberIds || memberIds.length === 0) {
            res.status(400).json({ message: "Group ID and member IDs are required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;
        const app = req.app; // Get the express app instance for notifications

        // Check if group exists and user has permission to invite
        const group = await models.Group.findByPk(groupId);
        if (!group) {
            res.status(404).json({ message: "Group not found" });
            return;
        }

        // Check if user is a member with permission to invite
        const inviterMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId: inviterId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] }
            }
        });

        if (!inviterMembership) {
            res.status(403).json({ message: "You don't have permission to invite members to this group" });
            return;
        }

        const users = await models.User.findAll({
            where: {
                id: { [Op.in]: memberIds }
            },
            attributes: ['id', 'firstName', 'lastName', 'email']
        });

        if (users.length === 0) {
            res.status(400).json({ message: "No valid users found with the provided member IDs" });
            return;
        }

        const foundMemberIds = users.map(user => user.id).filter((id): id is string => id !== undefined);
        const notFoundMemberIds = memberIds.filter(id => !foundMemberIds.includes(id));
        const inviter = await models.User.findByPk(inviterId);
        const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone';

        const results = await inviteUsersToGroup(groupId, foundMemberIds, inviterId, models, app);
        console.log('result', results);
        const failedResults = [
            ...results.failed,
            ...notFoundMemberIds.map(id => ({
                memberId: id,
                error: 'User not found'
            }))
        ];

        if (results.successful.length > 0) {
            try {
                await createAndSendNotification(app, {
                    type: NotificationType.GROUP_INVITATION_SENT,
                    recipientId: inviterId,
                    data: {
                        groupId: group.id,
                        groupName: group.name,
                        message: `You've successfully invited ${results.successful.length} member(s) to ${group.name}`,
                    }
                });
            } catch (notificationError) {
                console.error("Failed to send inviter notification:", notificationError);
            }
        }

        res.status(200).json({
            message: "Invitations processed",
            data: {
                successful: results.successful,
                failed: failedResults,
                totalInvited: results.successful.length
            }
        });
    } catch (error) {
        console.error("Invite to group error:", error);
        next(error);
    }
};

const respondToGroupInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { membershipId } = req.params;
        const { action }: RespondToGroupInvitationRequest = req.body;
        const userId = req.user.id;

        if (!membershipId || !action || !['accept', 'reject'].includes(action)) {
            res.status(400).json({ message: "Membership ID and valid action (accept/reject) are required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find the group invitation
        const membership: any = await models.GroupMember.findOne({
            where: {
                id: membershipId,
                userId,
                status: GroupMemberStatus.PENDING
            },
            include: [
                {
                    model: models.Group,
                    as: 'group'
                },
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        if (!membership) {
            res.status(404).json({ message: "Group invitation not found or already responded to" });
            return;
        }

        // Check if group is full (only for accept action)
        if (action === 'accept') {
            const group = membership.group;
            if (group.maxMembers && group.memberCount >= group.maxMembers) {
                res.status(400).json({ message: "Group is full" });
                return;
            }
        }

        // Update membership status
        const newStatus = action === 'accept' ? GroupMemberStatus.ACTIVE : GroupMemberStatus.REMOVED;
        await membership.update({
            status: newStatus,
            joinedAt: action === 'accept' ? new Date() : null,
            respondedAt: new Date()
        });

        // Update group member count if accepted
        if (action === 'accept') {
            await models.Group.increment('memberCount', { where: { id: membership.groupId } });
        }

        // Send notification email to inviter
        try {
            const currentUser = await models.User.findByPk(userId);
            if (currentUser && membership.inviter) {
                await sendEmail({
                    to: membership.inviter.email,
                    subject: `Group Invitation ${action === 'accept' ? 'Accepted' : 'Rejected'} - ${membership.group.name}`,
                    type: 'invitation_response',
                    data: {
                        responderName: `${currentUser.firstName} ${currentUser.lastName}`,
                        groupName: membership.group.name,
                        action: action,
                        actionText: action === 'accept' ? 'accepted' : 'rejected'
                    }
                });

                // Send in-app notification to inviter
                if (action === 'accept') {
                    await notifyGroupInvitationAccepted(
                        req.app,
                        membership.invitedBy,
                        membership.groupId,
                        membership.group.name,
                        userId,
                        `${currentUser.firstName} ${currentUser.lastName}`
                    );
                } else {
                    await notifyGroupInvitationRejected(
                        req.app,
                        membership.invitedBy,
                        membership.groupId,
                        membership.group.name,
                        userId,
                        `${currentUser.firstName} ${currentUser.lastName}`
                    );
                }
            }
        } catch (emailError) {
            console.error("Failed to send response notification email:", emailError);
        }

        const message = action === 'accept'
            ? `Successfully joined ${membership.group.name}`
            : `Group invitation rejected`;

        res.status(200).json({
            message,
            data: {
                id: membership.id,
                groupId: membership.groupId,
                groupName: membership.group.name,
                inviterName: membership.inviter ? `${membership.inviter.firstName} ${membership.inviter.lastName}` : undefined,
                status: membership.status,
                role: membership.role,
                joinedAt: membership.joinedAt,
                respondedAt: membership.respondedAt
            }
        });
    } catch (error) {
        console.error("Respond to group invitation error:", error);
        next(error);
    }
};

const joinGroupByLink = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accessToken, additionalInfo }: JoinGroupByLinkRequest = req.body;
        const userId = req.user.id;

        if (!accessToken) {
            res.status(400).json({ message: "Access token is required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find group by access token
        const group = await models.Group.findOne({
            where: { accessToken }
        });

        if (!group) {
            res.status(404).json({ message: "Invalid access link or QR code" });
            return;
        }

        // Check if user is already associated with the group
        const existingMembership = await models.GroupMember.findOne({
            where: {
                groupId: group.id,
                userId
            }
        });

        if (existingMembership) {
            let message = "You are already associated with this group";

            if (existingMembership.status === GroupMemberStatus.PENDING) {
                message = "You already have a pending request to join this group";
                res.status(200).json({
                    message,
                    data: {
                        requestId: existingMembership.id,
                        groupId: group.id,
                        groupName: group.name,
                        status: existingMembership.status,
                        requiresApproval: true
                    }
                });
                return;
            } else if (existingMembership.status === GroupMemberStatus.ACTIVE) {
                message = "You are already a member of this group";
                res.status(200).json({
                    message,
                    data: {
                        requestId: existingMembership.id,
                        groupId: group.id,
                        groupName: group.name,
                        status: existingMembership.status,
                        requiresApproval: false
                    }
                });
                return;
            } else if (existingMembership.status === GroupMemberStatus.REMOVED) {
                message = "Your previous request to join was declined";
            }

            res.status(400).json({ message });
            return;
        }

        // Check if group is full
        if (group.maxMembers && (group.memberCount || 0) >= group.maxMembers) {
            res.status(400).json({ message: "Group is full" });
            return;
        }

        // Create join request based on group privacy settings
        const isAutoApproved = group.privacyType === GroupPrivacyType.PUBLIC;
        const membership = await models.GroupMember.create({
            groupId: group.id,
            userId,
            role: GroupMemberRole.MEMBER,
            status: isAutoApproved ? GroupMemberStatus.ACTIVE : GroupMemberStatus.PENDING,
            invitedBy: userId, // Self-invited
            invitedAt: new Date(),
            joinedAt: isAutoApproved ? new Date() : undefined,
            autoApproved: isAutoApproved,
            additionalInfo
        });

        // If auto-approved (public group), increment member count
        if (isAutoApproved) {
            await models.Group.increment('memberCount', { where: { id: group.id } });
        }

        // Notify group owner ONLY for private groups requiring approval
        const [user, owner] = await Promise.all([
            models.User.findByPk(userId),
            models.User.findByPk(group.ownerId)
        ]);

        if (user && owner && !isAutoApproved) {
            // In-app notification
            await createAndSendNotification(req.app, {
                type: NotificationType.GROUP_JOIN_REQUEST,
                recipientId: group.ownerId,
                data: {
                    groupId: group.id,
                    groupName: group.name,
                    requestId: membership.id,
                    userId: user.id,
                    userName: `${user.firstName} ${user.lastName}`,
                    message: `${user.firstName} ${user.lastName} wants to join your group "${group.name}"`,
                    title: "Group Join Request",
                    actions: [
                        {
                            type: 'approve',
                            label: 'Approve',
                            url: `${process.env.FRONTEND_URL}/groups/${group.id}/requests/${membership.id}/respond?action=approve`
                        },
                        {
                            type: 'decline',
                            label: 'Decline',
                            url: `${process.env.FRONTEND_URL}/groups/${group.id}/requests/${membership.id}/respond?action=decline`
                        }
                    ]
                }
            });

            // Email notification. Do not fail the join request if SMTP is unavailable.
            try {
                await sendEmail({
                    to: owner.email,
                    subject: `New Join Request for ${group.name}`,
                    type: "group_join_request",
                    data: {
                        userName: `${user.firstName} ${user.lastName}`,
                        userEmail: user.email,
                        groupName: group.name,
                        approveUrl: `${process.env.FRONTEND_URL}/groups/${group.id}/requests/${membership.id}/respond?action=approve`,
                        declineUrl: `${process.env.FRONTEND_URL}/groups/${group.id}/requests/${membership.id}/respond?action=decline`
                    }
                });
            } catch (emailError) {
                console.error("Failed to send group join request email:", emailError);
            }
        }

        res.status(200).json({
            message: isAutoApproved
                ? `Successfully joined ${group.name}`
                : "Join request sent. Waiting for owner approval.",
            data: {
                requestId: membership.id,
                groupId: group.id,
                groupName: group.name,
                status: membership.status,
                requiresApproval: !isAutoApproved
            }
        });
    } catch (error) {
        console.error("Join group by link/QR code error:", error);
        next(error);
    }
};

const getUserGroups = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status = 'active' } = req.query;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        const offset = (Number(page) - 1) * Number(limit);

        // Ensure status is a string and matches the enum or 'all'
        let statusValue: string | { [Op.ne]: string };
        if (status === 'all') {
            statusValue = { [Op.ne]: GroupMemberStatus.REMOVED };
        } else if (typeof status === 'string') {
            statusValue = status;
        } else if (Array.isArray(status)) {
            statusValue = String(status[0]);
        } else {
            statusValue = GroupMemberStatus.ACTIVE;
        }

        const { count, rows: memberships } = await models.GroupMember.findAndCountAll({
            where: {
                userId,
                status: statusValue
            },
            include: [
                {
                    model: models.Group,
                    as: 'group',
                    include: [
                        {
                            model: models.User,
                            as: 'owner',
                            attributes: ['id', 'firstName', 'lastName']
                        },
                        {
                            model: models.Wallet,
                            as: 'wallet',
                            attributes: ['id', 'balance'],
                            required: false
                        }
                    ]
                }
            ],
            limit: Number(limit),
            offset,
            order: [['createdAt', 'DESC']]
        });

        const groups = memberships.map(membership => {
            const group = (membership as any).group;
            let ownerName: string | undefined = undefined;
            if (group && group.owner) {
                ownerName = `${group.owner.firstName} ${group.owner.lastName}`;
            }

            // Calculate fundraising progress if applicable
            let fundraisingProgress: number | undefined;
            let walletBalance: number | undefined;
            if (group.hasFundraising && group.wallet) {
                walletBalance = parseFloat(group.wallet.balance.toString());
                if (group.fundraisingTarget) {
                    const target = parseFloat(group.fundraisingTarget.toString());
                    fundraisingProgress = target > 0 ? Math.min((walletBalance / target) * 100, 100) : 0;
                }
            }

            return {
                id: group.id,
                name: group.name,
                description: group.description,
                picture: group.picture,
                ownerId: group.ownerId,
                ownerName,
                qrCode: group.qrCode,
                accessLink: group.accessLink,
                isPrivate: group.isPrivate,
                maxMembers: group.maxMembers,
                memberCount: group.memberCount,
                hasFundraising: group.hasFundraising,
                fundraisingTarget: group.fundraisingTarget ? parseFloat(group.fundraisingTarget.toString()) : undefined,
                fundraisingCurrentAmount: walletBalance !== undefined ? walletBalance : (group.fundraisingCurrentAmount ? parseFloat(group.fundraisingCurrentAmount.toString()) : undefined),
                fundraisingProgress: fundraisingProgress,
                walletId: group.walletId,
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
                userRole: membership.role,
                userStatus: membership.status
            };
        });

        res.status(200).json({
            message: "Groups retrieved successfully",
            data: {
                groups,
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / Number(limit))
            }
        });
    } catch (error) {
        console.error("Get user groups error:", error);
        next(error);
    }
};

// Helper function to invite users to group
const inviteUsersToGroup = async (
    groupId: string,
    memberIds: string[],
    inviterId: string,
    models: ReturnType<typeof Models>,
    app?: Application // Add app parameter to access notification service
) => {
    const successful: any[] = [];
    const failed: any[] = [];

    // Get inviter's contacts to validate invitations
    const inviterContacts = await models.Contact.findAll({
        where: {
            [Op.or]: [
                { userAId: inviterId, status: 'active' },
                { userBId: inviterId, status: 'active' }
            ]
        }
    });
    const contactUserIds = inviterContacts.map(contact =>
        contact.userAId === inviterId ? contact.userBId : contact.userAId
    );

    // Get group details for email
    const group = await models.Group.findByPk(groupId);
    const inviter = await models.User.findByPk(inviterId);

    for (const userId of memberIds) {
        try {
            // Find user by ID
            const user = await models.User.findOne({
                where: { id: userId }
            });

            if (!user) {
                failed.push({ userId, reason: "User not found" });
                continue;
            }

            // Check if user is in inviter's contacts
            if (!contactUserIds.includes(user.id)) {
                failed.push({ userId, reason: "User not in your contacts" });
                continue;
            }

            // Check if user is already a member or has pending invitation
            const existingMembership = await models.GroupMember.findOne({
                where: {
                    groupId,
                    userId: user.id,
                    status: { [Op.in]: [GroupMemberStatus.PENDING, GroupMemberStatus.ACTIVE] }
                }
            });

            if (existingMembership) {
                const reason = existingMembership.status === GroupMemberStatus.PENDING
                    ? "Already has pending invitation"
                    : "Already a member";
                failed.push({ userId, reason });
                continue;
            }

            // Create group membership invitation
            const invitationToken = uuidv4();
            const membership = await models.GroupMember.create({
                groupId,
                userId: user.id,
                role: GroupMemberRole.MEMBER,
                status: GroupMemberStatus.PENDING,
                invitedBy: inviterId,
                invitedAt: new Date(),
                autoApproved: false
            });

            // Create URLs for accept/reject actions
            const acceptUrl = `${process.env.FRONTEND_URL}/groups/respond?token=${invitationToken}&action=accept&membershipId=${membership.id}`;
            const rejectUrl = `${process.env.FRONTEND_URL}/groups/respond?token=${invitationToken}&action=reject&membershipId=${membership.id}`;

            // Send invitation email
            try {
                await sendEmail({
                    to: user.email,
                    subject: `You're Invited to Join ${group?.name}`,
                    type: 'group_invitation',
                    data: {
                        inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone',
                        groupName: group?.name || 'Unnamed Group',
                        groupDescription: group?.description || '',
                        acceptUrl,
                        rejectUrl
                    }
                });
            } catch (emailError) {
                console.error("Failed to send group invitation email:", emailError);
            }

            // Send notification to invited user
            if (app) {
                try {
                    await createAndSendNotification(app, {
                        type: NotificationType.GROUP_INVITATION,
                        recipientId: user.id,
                        data: {
                            groupId: group?.id,
                            groupName: group?.name,
                            userId: inviterId,
                            userName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone',
                            message: `${inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone'} invited you to join '${group?.name}'`,
                            actions: [
                                {
                                    type: 'accept',
                                    label: 'Accept',
                                    url: acceptUrl
                                },
                                {
                                    type: 'reject',
                                    label: 'Decline',
                                    url: rejectUrl
                                }
                            ]
                        }
                    });
                } catch (notificationError) {
                    console.error("Failed to send group invitation notification:", notificationError);
                }
            }

            successful.push({
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                membershipId: membership.id
            });

        } catch (error) {
            console.error(`Error inviting user ${userId}:`, error);
            failed.push({ userId, reason: "Server error" });
        }
    }

    return { successful, failed };
};

const getGroupDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Get group details
        const group = await models.Group.findByPk(groupId);

        if (!group) {
            res.status(404).json({ message: "Group not found" });
            return;
        }

        // Get owner's user record
        const owner = await models.User.findByPk(group.ownerId);

        // Get wallet balance if fundraising group
        let walletBalance: number | undefined;
        let fundraisingProgress: number | undefined;
        if (group.hasFundraising && group.walletId) {
            const wallet = await models.Wallet.findByPk(group.walletId);
            if (wallet) {
                walletBalance = parseFloat(wallet.balance.toString());
                if (group.fundraisingTarget) {
                    const target = parseFloat(group.fundraisingTarget.toString());
                    fundraisingProgress = target > 0 ? Math.min((walletBalance / target) * 100, 100) : 0;
                }
            }
        }

        // Get user's membership status
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: { [Op.ne]: GroupMemberStatus.REMOVED }
            }
        });

        // Show QR code and access link to active members, pending members, and owners
        const canViewSensitiveInfo = userMembership &&
            (userMembership.status === GroupMemberStatus.ACTIVE ||
                userMembership.status === GroupMemberStatus.PENDING ||
                userMembership.role === GroupMemberRole.OWNER);
        console.log('User can view sensitive info:', canViewSensitiveInfo);

        res.status(200).json({
            message: "Group details retrieved successfully",
            data: {
                id: group.id,
                name: group.name,
                description: group.description,
                picture: group.picture,
                profilePictureUrl: group.profilePictureUrl,
                ownerId: group.ownerId,
                adminId: group.adminId,
                ownerName: owner ? `${owner.firstName} ${owner.lastName}` : undefined,
                qrCode: canViewSensitiveInfo ? group.qrCode : null,
                accessLink: canViewSensitiveInfo ? group.accessLink : null,
                isPrivate: group.isPrivate,
                privacyType: group.privacyType,
                maxMembers: group.maxMembers,
                memberCount: group.memberCount,
                hasFundraising: group.hasFundraising,
                fundraisingTarget: group.fundraisingTarget ? parseFloat(group.fundraisingTarget.toString()) : undefined,
                fundraisingCurrentAmount: walletBalance !== undefined ? walletBalance : parseFloat(group.fundraisingCurrentAmount.toString()),
                fundraisingProgress: fundraisingProgress,
                walletId: group.walletId,
                expirationDate: group.expirationDate?.toISOString(),
                expirationType: group.expirationType,
                hasAdditionalInfo: group.hasAdditionalInfo,
                additionalInfoPrompt: group.additionalInfoPrompt,
                createdAt: group.createdAt,
                updatedAt: group.updatedAt,
                userRole: userMembership?.role,
                userStatus: userMembership?.status
            }
        });
    } catch (error) {
        console.error("Get group details error:", error);
        next(error);
    }
};

const getGroupMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const { page = 1, limit = 20, status = 'active' } = req.query;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Check if user is a member of the group
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
            }
        });

        if (!userMembership) {
            res.status(403).json({ message: "You are not a member of this group" });
            return;
        }

        const offset = (Number(page) - 1) * Number(limit);

        // Ensure status is a string and matches the enum or 'all'
        let statusValue: string | { [Op.ne]: string };
        if (status === 'all') {
            statusValue = { [Op.ne]: GroupMemberStatus.REMOVED };
        } else if (typeof status === 'string') {
            statusValue = status;
        } else if (Array.isArray(status)) {
            statusValue = String(status[0]);
        } else {
            statusValue = GroupMemberStatus.ACTIVE;
        }

        const { count, rows: members } = await models.GroupMember.findAndCountAll({
            where: {
                groupId,
                status: statusValue
            },
            include: [
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            limit: Number(limit),
            offset,
            order: [
                ['role', 'ASC'], // Owner first, then admin, then members
                ['joinedAt', 'ASC']
            ]
        });

        const membersList = members.map(member => {
            const m = member as any;
            return {
                id: m.id,
                userId: m.userId,
                userName: `${m.user.firstName} ${m.user.lastName}`,
                userEmail: m.user.email,
                useruserId: m.user.userId,
                role: m.role,
                status: m.status,
                joinedAt: m.joinedAt,
                invitedAt: m.invitedAt,
                invitedByName: m.inviter ? `${m.inviter.firstName} ${m.inviter.lastName}` : undefined
            };
        });

        res.status(200).json({
            message: "Group members retrieved successfully",
            data: {
                members: membersList,
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / Number(limit))
            }
        });
    } catch (error) {
        console.error("Get group members error:", error);
        next(error);
    }
};

const updateGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const { name, description, picture, isPrivate, privacyType, maxMembers }: UpdateGroupRequest = req.body;
        const userId = req.user.id;

        if (privacyType !== undefined && !Object.values(GroupPrivacyType).includes(privacyType)) {
            res.status(400).json({ message: "Invalid privacyType" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Check if user is the owner or admin
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] }
            }
        });

        if (!userMembership) {
            res.status(403).json({ message: "You don't have permission to update this group" });
            return;
        }

        const group = await models.Group.findByPk(groupId);
        if (!group) {
            res.status(404).json({ message: "Group not found" });
            return;
        }

        // Prepare update data
        const updateData: any = {};
        if (name !== undefined && name.trim().length >= 2) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim();
        if (picture !== undefined) updateData.picture = picture;
        if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
        if (privacyType !== undefined) updateData.privacyType = privacyType;
        if (maxMembers !== undefined && maxMembers >= (group.memberCount || 0)) updateData.maxMembers = maxMembers;

        // Update the group
        await group.update(updateData);

        // Get updater info for notifications
        const updater = await models.User.findByPk(userId);
        const updaterName = updater ? `${updater.firstName} ${updater.lastName}` : 'Admin';

        // Determine what was updated for the notification message
        const changes = [];
        if (updateData.name) changes.push('name');
        if (updateData.description !== undefined) changes.push('description');
        if (updateData.picture) changes.push('picture');
        if (updateData.isPrivate !== undefined || updateData.privacyType !== undefined) changes.push('privacy settings');
        if (updateData.maxMembers) changes.push('member limit');

        const updateDescription = changes.length > 0
            ? `Updated ${changes.join(', ')}`
            : 'Group information updated';

        // Notify all active members about the group update
        const activeMembers = await models.GroupMember.findAll({
            where: {
                groupId,
                userId: { [Op.ne]: userId },
                status: GroupMemberStatus.ACTIVE
            }
        });

        const notificationPromises = activeMembers.map(member =>
            notifyGroupUpdated(
                req.app,
                member.userId,
                groupId,
                group.name,
                userId,
                updaterName,
                updateDescription
            )
        );

        await Promise.all(notificationPromises);

        res.status(200).json({
            message: "Group updated successfully",
            data: {
                id: group.id,
                name: group.name,
                description: group.description,
                picture: group.picture,
                isPrivate: group.isPrivate,
                maxMembers: group.maxMembers,
                updatedAt: group.updatedAt
            }
        });
    } catch (error) {
        console.error("Update group error:", error);
        next(error);
    }
};

const leaveGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;
        const membership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE
            }
        });

        if (!membership) {
            res.status(404).json({ message: "You are not a member of this group" });
            return;
        }

        // Owners cannot leave their own group
        if (membership.role === GroupMemberRole.OWNER) {
            res.status(400).json({ message: "Group owners cannot leave. Transfer ownership or delete the group instead." });
            return;
        }
        const group = await models.Group.findByPk(groupId);
        const user = await models.User.findByPk(userId);

        // Update membership status to LEFT
        await membership.update({
            status: GroupMemberStatus.LEFT,
            respondedAt: new Date()
        });

        // Decrease group member count
        await models.Group.decrement('memberCount', { where: { id: groupId } });
        const members = await models.GroupMember.findAll({
            where: {
                groupId,
                userId: { [Op.ne]: userId },
                status: GroupMemberStatus.ACTIVE
            }
        })
        const notificationPromises = members.map(member =>
            createAndSendNotification(req.app, {
                type: NotificationType.GROUP_MEMBER_LEFT,
                recipientId: member.userId,
                data: {
                    groupId: groupId,
                    groupName: group?.name,
                    userId: userId,
                    userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown user',
                    message: `${user?.firstName} ${user?.lastName} has left the group '${group?.name}'`
                }
            })
        );

        await Promise.all(notificationPromises);
        res.status(200).json({
            message: "Successfully left the group"
        });
    } catch (error) {
        console.error("Leave group error:", error);
        next(error);
    }
};

const removeMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId, memberId } = req.params;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Check if user has permission (owner or admin)
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] }
            }
        });

        if (!userMembership) {
            res.status(403).json({ message: "You don't have permission to remove members" });
            return;
        }

        // Find the member to remove
        const memberToRemove: any = await models.GroupMember.findOne({
            where: {
                id: memberId,
                groupId,
                status: GroupMemberStatus.ACTIVE
            },
            include: [
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['firstName', 'lastName', 'email']
                }
            ]
        });

        if (!memberToRemove) {
            res.status(404).json({ message: "Member not found in this group" });
            return;
        }

        // Cannot remove the owner
        if (memberToRemove.role === GroupMemberRole.OWNER) {
            res.status(400).json({ message: "Cannot remove the group owner" });
            return;
        }

        // Admins can only be removed by owners
        if (memberToRemove.role === GroupMemberRole.ADMIN && userMembership.role !== GroupMemberRole.OWNER) {
            res.status(403).json({ message: "Only owners can remove admins" });
            return;
        }

        // Update membership status to REMOVED
        await memberToRemove.update({
            status: GroupMemberStatus.REMOVED,
            respondedAt: new Date()
        });

        // Decrease group member count
        await models.Group.decrement('memberCount', { where: { id: groupId } });
        const group = await models.Group.findByPk(groupId);
        const remover = await models.User.findByPk(userId);

        // Notify the removed member
        await createAndSendNotification(req.app, {
            type: NotificationType.MEMBER_REMOVED_FROM_GROUP,
            recipientId: memberId,
            data: {
                groupId: groupId,
                groupName: group?.name,
                userId: userId,
                userName: remover ? `${remover.firstName} ${remover.lastName}` : 'Unknown admin',
                message: `You have been removed from the group '${group?.name}' by ${remover?.firstName} ${remover?.lastName}`
            }
        });
        const otherMembers = await models.GroupMember.findAll({
            where: {
                groupId,
                userId: { [Op.ne]: userId },
                status: GroupMemberStatus.ACTIVE
            }
        });
        const notificationPromises = otherMembers.map(member =>
            createAndSendNotification(req.app, {
                type: NotificationType.MEMBER_REMOVED_FROM_GROUP,
                recipientId: member.userId,
                data: {
                    groupId: groupId,
                    groupName: group?.name,
                    userId: memberId,
                    userName: `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`,
                    message: `${memberToRemove.user.firstName} ${memberToRemove.user.lastName} has been removed from the group '${group?.name}' by ${remover?.firstName} ${remover?.lastName}`
                }
            })
        );

        await Promise.all(notificationPromises);

        res.status(200).json({
            message: `Successfully removed ${memberToRemove.user.firstName} ${memberToRemove.user.lastName} from the group`
        });
    } catch (error) {
        console.error("Remove member error:", error);
        next(error);
    }
};

const deleteGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Check if user is the owner
        const group = await models.Group.findOne({
            where: {
                id: groupId,
                ownerId: userId
            }
        });

        if (!group) {
            res.status(403).json({ message: "You can only delete groups you own" });
            return;
        }

        const members = await models.GroupMember.findAll({
            where: { groupId },
            include: [
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName']
                }
            ]
        });

        const owner = await models.User.findByPk(userId);
        const notificationPromises = members
            .filter(member => member.userId !== userId)
            .map(member =>
                createAndSendNotification(req.app, {
                    type: NotificationType.GROUP_DELETED,
                    recipientId: member.userId,
                    data: {
                        groupId: groupId,
                        groupName: group?.name,
                        userId: userId,
                        userName: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown owner',
                        message: `The group '${group?.name}' has been deleted by ${owner?.firstName} ${owner?.lastName}`
                    }
                })
            );

        await Promise.all(notificationPromises);

        // Delete all group members (cascade should handle this, but being explicit)
        await models.GroupMember.destroy({
            where: { groupId }
        });

        // Delete the group
        await group.destroy();

        res.status(200).json({
            message: "Group deleted successfully"
        });
    } catch (error) {
        console.error("Delete group error:", error);
        next(error);
    }
};

const requestToJoinGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Check if group exists
        const group = await models.Group.findByPk(groupId);
        if (!group) {
            res.status(404).json({ message: "Group not found" });
            return;
        }

        // Check if user is already a member or has pending request
        const existingMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: { [Op.in]: [GroupMemberStatus.PENDING, GroupMemberStatus.ACTIVE] }
            }
        });

        if (existingMembership) {
            const message = existingMembership.status === GroupMemberStatus.PENDING
                ? "You already have a pending request to join this group"
                : "You are already a member of this group";
            res.status(400).json({ message });
            return;
        }

        // Check if group is full
        if (group.maxMembers && (group.memberCount || 0) >= group.maxMembers) {
            res.status(400).json({ message: "Group is full" });
            return;
        }

        // Create join request (without requestMessage)
        const membership = await models.GroupMember.create({
            groupId,
            userId,
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.PENDING,
            invitedBy: userId, // Self-invited for join requests
            invitedAt: new Date(),
            autoApproved: false
        });

        // Get user and owner details for notification
        const [user, owner] = await Promise.all([
            models.User.findByPk(userId),
            models.User.findByPk(group.ownerId)
        ]);

        if (user && owner) {
            // Send email notification to group owner. Do not fail the join request if SMTP is unavailable.
            try {
                await sendEmail({
                    to: owner.email,
                    subject: `New Join Request for ${group.name}`,
                    type: "group_join_request",
                    data: {
                        userName: `${user.firstName} ${user.lastName}`,
                        userEmail: user.email,
                        groupName: group.name,
                        approveUrl: `${process.env.FRONTEND_URL}/groups/${groupId}/requests/${membership.id}/respond?action=approve`,
                        declineUrl: `${process.env.FRONTEND_URL}/groups/${groupId}/requests/${membership.id}/respond?action=decline`
                    }
                });
            } catch (emailError) {
                console.error("Failed to send group join request email:", emailError);
            }

            // Send in-app notification to group owner
            await createAndSendNotification(req.app, {
                type: NotificationType.GROUP_JOIN_REQUEST,
                recipientId: group.ownerId,
                data: {
                    groupId: group.id,
                    groupName: group.name,
                    requestId: membership.id,
                    userId: user.id,
                    userName: `${user.firstName} ${user.lastName}`,
                    message: `${user.firstName} ${user.lastName} wants to join your group "${group.name}"`,
                    title: "Group Join Request",
                    actions: [
                        {
                            type: 'approve',
                            label: 'Approve',
                            url: `${process.env.FRONTEND_URL}/groups/${groupId}/requests/${membership.id}/respond?action=approve`
                        },
                        {
                            type: 'decline',
                            label: 'Decline',
                            url: `${process.env.FRONTEND_URL}/groups/${groupId}/requests/${membership.id}/respond?action=decline`
                        }
                    ]
                }
            });
        }

        res.status(200).json({
            message: "Join request sent successfully",
            data: {
                requestId: membership.id,
                groupId: group.id,
                groupName: group.name,
                status: membership.status,
                requestedAt: membership.invitedAt
            }
        });
    } catch (error) {
        console.error("Request to join group error:", error);
        next(error);
    }
};

// Update the getJoinRequests method to remove requestMessage reference
const getJoinRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const models = req.app.get('models') as ReturnType<typeof Models>;
        const offset = (Number(page) - 1) * Number(limit);

        // Check if user has permission to view requests (owner or admin)
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] }
            }
        });

        if (!userMembership) {
            res.status(403).json({ message: "You don't have permission to view join requests" });
            return;
        }

        // Get pending join requests
        const { count, rows: requests } = await models.GroupMember.findAndCountAll({
            where: {
                groupId,
                status: GroupMemberStatus.PENDING,
                [Op.and]: literal('"GroupMember"."invitedBy" = "GroupMember"."userId"') // Self-invited requests
            },
            include: [
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            limit: Number(limit),
            offset,
            order: [['invitedAt', 'DESC']]
        });

        const formattedRequests = requests.map(request => {
            const r = request as any;
            return {
                id: r.id,
                userId: r.userId,
                userName: `${r.user.firstName} ${r.user.lastName}`,
                userEmail: r.user.email,
                requestedAt: r.invitedAt
            };
        });

        res.status(200).json({
            message: "Join requests retrieved successfully",
            data: {
                requests: formattedRequests,
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / Number(limit))
            }
        });
    } catch (error) {
        console.error("Get join requests error:", error);
        next(error);
    }
};
const respondToJoinRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId, requestId } = req.params;
        const { action } = req.body; // 'approve' or 'decline'
        const userId = req.user.id;

        if (!action || !['approve', 'decline'].includes(action)) {
            res.status(400).json({ message: "Valid action (approve/decline) is required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Verify requester has permission (owner or admin)
        const userMembership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] }
            }
        });
        if (!userMembership) {
            res.status(403).json({ message: "You don't have permission to respond to join requests" });
            return;
        }

        // Find the join request
        const joinRequest = await models.GroupMember.findOne({
            where: {
                id: requestId,
                groupId,
                status: GroupMemberStatus.PENDING
            },
            include: [
                {
                    model: models.User,
                    as: 'user'
                }
            ]
        });

        if (!joinRequest) {
            res.status(404).json({ message: "Join request not found or already processed" });
            return;
        }

        // Update the request status
        const newStatus = action === 'approve' ? GroupMemberStatus.ACTIVE : GroupMemberStatus.REMOVED;
        const updateData: any = {
            status: newStatus,
            respondedAt: new Date(),
            invitedBy: userId
        };

        if (action === 'approve') {
            updateData.joinedAt = new Date();
            await models.Group.increment('memberCount', { where: { id: groupId } });
        }

        await joinRequest.update(updateData);

        // Send notification to requester
        const requesterId = joinRequest.userId;
        const notificationType = action === 'approve'
            ? NotificationType.GROUP_JOIN_APPROVED
            : NotificationType.GROUP_JOIN_REJECTED;

        await createAndSendNotification(req.app, {
            type: notificationType,
            recipientId: requesterId,
            data: {
                groupId,
                groupName: (await models.Group.findByPk(groupId))?.name || 'Unknown Group',
                requestId,
                userId,
                userName: `${req.user.firstName} ${req.user.lastName}`,
                message: action === 'approve'
                    ? `Your request to join the group has been approved`
                    : `Your request to join the group has been declined`
            }
        });

        // Send email notification
        try {
            const requester = await models.User.findByPk(requesterId);
            const group = await models.Group.findByPk(groupId);
            const respondingUser = await models.User.findByPk(userId);

            if (requester && group && respondingUser) {
                await sendEmail({
                    to: requester.email,
                    subject: `Group Join Request ${action === 'approve' ? 'Approved' : 'Declined'} - ${group.name}`,
                    type: 'join_request_response',
                    data: {
                        groupName: group.name,
                        responderName: `${respondingUser.firstName} ${respondingUser.lastName}`,
                        action: action === 'approve' ? 'approved' : 'declined',
                        actionText: action === 'approve' ? 'approved your request to join' : 'declined your request to join',
                        message: action === 'approve'
                            ? `You can now access the group and participate in conversations`
                            : `Feel free to request to join again if you wish`,
                        groupLink: action === 'approve'
                            ? `${process.env.FRONTEND_URL}/chat`
                            : undefined
                    }
                });
            }
        } catch (emailError) {
            console.error("Failed to send response notification email:", emailError);
        }

        res.status(200).json({
            message: `Join request ${action === 'approve' ? 'approved' : 'declined'} successfully`,
            data: {
                requestId: joinRequest.id,
                userId: joinRequest.userId,
                status: joinRequest.status
            }
        });
    } catch (error) {
        console.error("Respond to join request error:", error);
        next(error);
    }
};

/**
 * GET /api/v1/groups/:groupId/members/search?q=<query>&limit=10
 *
 * Fuzzy-search active group members by name or username.
 * Used by the @mention autocomplete on the frontend.
 * Requesting user must be an active member of the group.
 */
const searchGroupMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { groupId } = req.params;
        const q           = String(req.query.q || "").trim().toLowerCase();
        const limit       = Math.min(parseInt(String(req.query.limit || "10"), 10) || 10, 20);
        const userId      = req.user.id;

        const models = req.app.get("models") as ReturnType<typeof Models>;

        // Verify requesting user is an active member
        const requesterMembership = await models.GroupMember.findOne({
            where: { groupId, userId, status: "active" },
        });
        if (!requesterMembership) {
            res.status(403).json({ message: "You are not a member of this group" });
            return;
        }

        // Fetch all active members (exclude self), then filter in JS for portability
        // (JSONB-agnostic — works across Postgres versions)
        const members = await models.GroupMember.findAll({
            where: {
                groupId,
                status: "active",
                userId: { [Op.ne]: userId },
            },
            include: [
                {
                    model: models.User,
                    as:         "user",
                    attributes: ["id", "firstName", "lastName", "email"],
                    include: [
                        {
                            model:      models.Profile,
                            as:         "profile",
                            attributes: ["profileImage"],
                            required:   false,
                        },
                    ],
                },
            ],
            limit: 100, // Fetch more, filter in-memory for partial-match quality
        });

        const results = members
            .map((m: any) => {
                const user     = m.user;
                const profile  = user?.profile;
                const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
                const emailHandle = String(user?.email || "")
                    .split("@")[0]
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, "");
                const mentionLabel = fullName || emailHandle || `user.${String(user?.id || "").slice(0, 8)}`;
                return {
                    userId:   user?.id,
                    username: mentionLabel,
                    name:     fullName || mentionLabel,
                    avatar:   profile?.profileImage || null,
                };
            })
            .filter((u: any) => {
                if (!u.userId) return false;
                if (!q) return true;
                return (
                    u.name.toLowerCase().includes(q) ||
                    u.username.toLowerCase().includes(q)
                );
            })
            .slice(0, limit);

        res.status(200).json({ data: results });
    } catch (error) {
        next(error);
    }
};

export {
    createGroup,
    inviteToGroup,
    respondToGroupInvitation,
    joinGroupByLink,
    getUserGroups,
    getGroupDetails,
    getGroupMembers,
    updateGroup,
    leaveGroup,
    removeMember,
    deleteGroup,
    requestToJoinGroup,
    getJoinRequests,
    respondToJoinRequest,
    searchGroupMembers,
    getGroupWallet,
};

// ─── getGroupWallet ──────────────────────────────────────────────────────────

async function getGroupWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const models = req.app.get("models") as ReturnType<typeof Models>;
        const { groupId } = req.params;
        const userId = req.user.id;

        // Must be an active admin/owner
        const membership = await models.GroupMember.findOne({
            where: {
                groupId,
                userId,
                status: GroupMemberStatus.ACTIVE,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
            },
        });
        if (!membership) {
            res.status(403).json({ success: false, message: "Admin access required" });
            return;
        }

        const group = await models.Group.findByPk(groupId);
        if (!group) {
            res.status(404).json({ success: false, message: "Group not found" });
            return;
        }

        if (!group.walletId) {
            res.status(200).json({
                success: true,
                data: { balance: 0, currency: "RWF", transactions: [] },
            });
            return;
        }

        const wallet = await models.Wallet.findByPk(group.walletId);
        if (!wallet) {
            res.status(200).json({
                success: true,
                data: { balance: 0, currency: "RWF", transactions: [] },
            });
            return;
        }

        const transactions = await models.Transaction.findAll({
            where: {
                [Op.or]: [
                    { senderWalletId: wallet.id },
                    { receiverWalletId: wallet.id },
                ],
            },
            order: [["createdAt", "DESC"]],
            limit: 50,
            include: [
                {
                    model: models.Wallet,
                    as: "senderWallet",
                    attributes: ["id", "userId", "groupId"],
                    include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "lastName"], required: false }],
                },
                {
                    model: models.Wallet,
                    as: "receiverWallet",
                    attributes: ["id", "userId", "groupId"],
                    include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "lastName"], required: false }],
                },
            ],
        });

        const balance = parseFloat(wallet.balance.toString());

        res.status(200).json({
            success: true,
            data: {
                walletId: wallet.id,
                balance,
                currency: wallet.currency || "RWF",
                transactions: transactions.map((t) => {
                    const plain = t.toJSON() as any;
                    plain.direction = t.receiverWalletId === wallet.id ? "in" : "out";
                    return plain;
                }),
            },
        });
    } catch (error) {
        console.error("getGroupWallet error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
