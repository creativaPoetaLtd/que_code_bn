import { Response, NextFunction } from "express";
import { Op } from "sequelize";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";
import { GroupMemberStatus, GroupMemberRole } from "../types/group";
import { createAndSendNotification } from "../utils/notificationService";
import { NotificationType } from "../utils/notificationConfig";
import sendEmail from "../helpers/email";

/**
 * Get all pending group invitations for the authenticated user
 */
export const getPendingInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const models = req.app.get('models') as ReturnType<typeof Models>;

        const pendingInvitations = await models.GroupMember.findAll({
            where: {
                userId,
                status: GroupMemberStatus.PENDING
            },
            include: [
                {
                    model: models.Group,
                    as: 'group',
                    attributes: ['id', 'name', 'description', 'profilePictureUrl', 'picture', 'hasFundraising', 'fundraisingTarget', 'hasAdditionalInfo', 'additionalInfoPrompt']
                },
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        const formattedInvitations = pendingInvitations.map((invitation: any) => ({
            id: invitation.id,
            groupId: invitation.groupId,
            invitedAt: invitation.invitedAt,
            invitationMessage: invitation.invitationMessage,
            group: {
                id: invitation.group.id,
                name: invitation.group.name,
                description: invitation.group.description,
                profilePictureUrl: invitation.group.profilePictureUrl || invitation.group.picture,
                hasFundraising: invitation.group.hasFundraising,
                fundraisingTarget: invitation.group.fundraisingTarget,
                hasAdditionalInfo: invitation.group.hasAdditionalInfo,
                additionalInfoPrompt: invitation.group.additionalInfoPrompt
            },
            inviter: {
                id: invitation.inviter.id,
                name: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
                email: invitation.inviter.email
            }
        }));

        res.status(200).json({
            message: "Pending invitations retrieved successfully",
            data: {
                invitations: formattedInvitations,
                total: formattedInvitations.length
            }
        });
    } catch (error) {
        console.error("Get pending invitations error:", error);
        next(error);
    }
};

/**
 * Get all pending join requests for groups owned/administered by the user
 */
export const getPendingJoinRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find groups where user is owner or admin
        const userGroups = await models.GroupMember.findAll({
            where: {
                userId,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
                status: GroupMemberStatus.ACTIVE
            },
            attributes: ['groupId']
        });

        const groupIds = userGroups.map((membership: any) => membership.groupId);

        if (groupIds.length === 0) {
            res.status(200).json({
                message: "No pending join requests found",
                data: { requests: [], total: 0 }
            });
            return;
        }

        // Find pending join requests for these groups
        const pendingRequests = await models.GroupMember.findAll({
            where: {
                groupId: { [Op.in]: groupIds },
                status: GroupMemberStatus.PENDING,
                invitedBy: { [Op.col]: 'userId' } // Self-invited (join requests)
            },
            include: [
                {
                    model: models.Group,
                    as: 'group',
                    attributes: ['id', 'name', 'description', 'profilePictureUrl', 'picture']
                },
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        const formattedRequests = pendingRequests.map((request: any) => ({
            id: request.id,
            groupId: request.groupId,
            userId: request.userId,
            requestedAt: request.invitedAt,
            additionalInfo: request.additionalInfo,
            group: {
                id: request.group.id,
                name: request.group.name,
                description: request.group.description,
                profilePictureUrl: request.group.profilePictureUrl || request.group.picture
            },
            user: {
                id: request.user.id,
                name: `${request.user.firstName} ${request.user.lastName}`,
                email: request.user.email
            }
        }));

        res.status(200).json({
            message: "Pending join requests retrieved successfully",
            data: {
                requests: formattedRequests,
                total: formattedRequests.length
            }
        });
    } catch (error) {
        console.error("Get pending join requests error:", error);
        next(error);
    }
};

/**
 * Approve or deny a group join request
 */
export const respondToJoinRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId } = req.params;
        const { action, rejectionReason } = req.body; // action: 'approve' | 'deny'
        const responderId = req.user.id;

        if (!requestId || !action || !['approve', 'deny'].includes(action)) {
            res.status(400).json({ message: "Request ID and valid action (approve/deny) are required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find the join request
        const joinRequest: any = await models.GroupMember.findOne({
            where: {
                id: requestId,
                status: GroupMemberStatus.PENDING
            },
            include: [
                {
                    model: models.Group,
                    as: 'group'
                },
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        if (!joinRequest) {
            res.status(404).json({ message: "Join request not found or already processed" });
            return;
        }

        // Check if the responder has permission (owner or admin)
        const responderMembership = await models.GroupMember.findOne({
            where: {
                groupId: joinRequest.groupId,
                userId: responderId,
                role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
                status: GroupMemberStatus.ACTIVE
            }
        });

        if (!responderMembership) {
            res.status(403).json({ message: "You don't have permission to respond to this request" });
            return;
        }

        // Check if group is full (only for approve action)
        if (action === 'approve') {
            const group = joinRequest.group;
            if (group.maxMembers && group.memberCount >= group.maxMembers) {
                res.status(400).json({ message: "Group is full" });
                return;
            }
        }

        // Update the join request
        const newStatus = action === 'approve' ? GroupMemberStatus.ACTIVE : GroupMemberStatus.REJECTED;
        await joinRequest.update({
            status: newStatus,
            joinedAt: action === 'approve' ? new Date() : null,
            respondedAt: new Date(),
            approvedBy: action === 'approve' ? responderId : null,
            rejectedBy: action === 'deny' ? responderId : null,
            rejectedAt: action === 'deny' ? new Date() : null,
            rejectionReason: action === 'deny' ? rejectionReason : null
        });

        // Update group member count if approved
        if (action === 'approve') {
            await models.Group.increment('memberCount', { where: { id: joinRequest.groupId } });
        }

        // Send notification to the requester
        const message = action === 'approve' 
            ? `Your request to join '${joinRequest.group.name}' has been approved!`
            : `Your request to join '${joinRequest.group.name}' has been denied.`;

        await createAndSendNotification(req.app, {
            type: action === 'approve' ? NotificationType.GROUP_JOIN_APPROVED : NotificationType.GROUP_JOIN_REJECTED,
            recipientId: joinRequest.userId,
            data: {
                groupId: joinRequest.groupId,
                groupName: joinRequest.group.name,
                message
            }
        });

        // Send email notification
        try {
            const responder = await models.User.findByPk(responderId);
            if (responder) {
                await sendEmail({
                    to: joinRequest.user.email,
                    subject: `Group Join Request ${action === 'approve' ? 'Approved' : 'Denied'} - ${joinRequest.group.name}`,
                    type: 'join_request_response',
                    data: {
                        requesterName: `${joinRequest.user.firstName} ${joinRequest.user.lastName}`,
                        groupName: joinRequest.group.name,
                        responderName: `${responder.firstName} ${responder.lastName}`,
                        action,
                        actionText: action === 'approve' ? 'approved' : 'denied',
                        rejectionReason
                    }
                });
            }
        } catch (emailError) {
            console.error("Failed to send join request response email:", emailError);
        }

        res.status(200).json({
            message: `Join request ${action === 'approve' ? 'approved' : 'denied'} successfully`,
            data: {
                requestId: joinRequest.id,
                userId: joinRequest.userId,
                groupId: joinRequest.groupId,
                status: joinRequest.status,
                action
            }
        });
    } catch (error) {
        console.error("Respond to join request error:", error);
        next(error);
    }
};

/**
 * Bulk approve or deny multiple join requests
 */
export const bulkRespondToJoinRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestIds, action, rejectionReason } = req.body; // action: 'approve' | 'deny'
        const responderId = req.user.id;

        if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
            res.status(400).json({ message: "Request IDs array is required" });
            return;
        }

        if (!action || !['approve', 'deny'].includes(action)) {
            res.status(400).json({ message: "Valid action (approve/deny) is required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find all join requests
        const joinRequests = await models.GroupMember.findAll({
            where: {
                id: { [Op.in]: requestIds },
                status: GroupMemberStatus.PENDING
            },
            include: [
                {
                    model: models.Group,
                    as: 'group'
                },
                {
                    model: models.User,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        if (joinRequests.length === 0) {
            res.status(404).json({ message: "No valid join requests found" });
            return;
        }

        const results = {
            successful: [] as any[],
            failed: [] as any[]
        };

        for (const joinRequest of joinRequests as any[]) {
            try {
                // Check permissions for each group
                const responderMembership = await models.GroupMember.findOne({
                    where: {
                        groupId: joinRequest.groupId,
                        userId: responderId,
                        role: { [Op.in]: [GroupMemberRole.OWNER, GroupMemberRole.ADMIN] },
                        status: GroupMemberStatus.ACTIVE
                    }
                });

                if (!responderMembership) {
                    results.failed.push({
                        requestId: joinRequest.id,
                        reason: "No permission for this group"
                    });
                    continue;
                }

                // Check if group is full (only for approve action)
                if (action === 'approve') {
                    const group = joinRequest.group;
                    if (group.maxMembers && group.memberCount >= group.maxMembers) {
                        results.failed.push({
                            requestId: joinRequest.id,
                            reason: "Group is full"
                        });
                        continue;
                    }
                }

                // Update the join request
                const newStatus = action === 'approve' ? GroupMemberStatus.ACTIVE : GroupMemberStatus.REJECTED;
                await joinRequest.update({
                    status: newStatus,
                    joinedAt: action === 'approve' ? new Date() : null,
                    respondedAt: new Date(),
                    approvedBy: action === 'approve' ? responderId : null,
                    rejectedBy: action === 'deny' ? responderId : null,
                    rejectedAt: action === 'deny' ? new Date() : null,
                    rejectionReason: action === 'deny' ? rejectionReason : null
                });

                // Update group member count if approved
                if (action === 'approve') {
                    await models.Group.increment('memberCount', { where: { id: joinRequest.groupId } });
                }

                // Send notification
                const message = action === 'approve' 
                    ? `Your request to join '${joinRequest.group.name}' has been approved!`
                    : `Your request to join '${joinRequest.group.name}' has been denied.`;

                await createAndSendNotification(req.app, {
                    type: action === 'approve' ? NotificationType.GROUP_JOIN_APPROVED : NotificationType.GROUP_JOIN_REJECTED,
                    recipientId: joinRequest.userId,
                    data: {
                        groupId: joinRequest.groupId,
                        groupName: joinRequest.group.name,
                        message
                    }
                });

                results.successful.push({
                    requestId: joinRequest.id,
                    userId: joinRequest.userId,
                    groupId: joinRequest.groupId,
                    groupName: joinRequest.group.name,
                    userName: `${joinRequest.user.firstName} ${joinRequest.user.lastName}`
                });

            } catch (error) {
                console.error(`Error processing request ${joinRequest.id}:`, error);
                results.failed.push({
                    requestId: joinRequest.id,
                    reason: "Processing error"
                });
            }
        }

        res.status(200).json({
            message: `Bulk ${action} completed`,
            data: {
                successful: results.successful,
                failed: results.failed,
                totalProcessed: requestIds.length,
                successCount: results.successful.length,
                failureCount: results.failed.length
            }
        });
    } catch (error) {
        console.error("Bulk respond to join requests error:", error);
        next(error);
    }
};