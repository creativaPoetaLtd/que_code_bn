import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import Models from "../database/models";
import { ContactStatus } from "../types/contact";
import { AuthenticatedRequest } from "../types/requests";
import sendEmail from "../helpers/email";

const inviteContact = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { publicId } = req.body;
        const inviterId = req.user.id;

        if (!publicId) {
            res.status(400).json({ message: "Public ID is required" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        const invitee = await models.User.findOne({
            where: { publicId }
        });

        if (!invitee) {
            res.status(404).json({ message: "User not found with this public ID" });
            return;
        }

        const inviteeId = invitee.id;

        // Check if user is trying to invite themselves
        if (inviterId === inviteeId) {
            res.status(400).json({ message: "You cannot invite yourself" });
            return;
        }

        // Check for existing contact relationship
        const existingContact = await models.Contact.findOne({
            where: {
                [Op.or]: [
                    { inviterId, inviteeId },
                    { inviterId: inviteeId, inviteeId: inviterId }
                ]
            }
        });

        if (existingContact) {
            let message = "";
            if (existingContact.inviterId === inviterId) {
                if (existingContact.status === ContactStatus.PENDING) {
                    message = "You have already sent an invitation to this user";
                } else if (existingContact.status === ContactStatus.ACCEPTED) {
                    message = "This user is already in your contacts";
                } else if (existingContact.status === ContactStatus.REJECTED) {
                    message = "Your previous invitation to this user was rejected";
                }
            } else {
                if (existingContact.status === ContactStatus.PENDING) {
                    message = "This user has already sent you an invitation. Check your received invitations.";
                } else if (existingContact.status === ContactStatus.ACCEPTED) {
                    message = "This user is already in your contacts";
                }
            }
            res.status(400).json({ message });
            return;
        }

        // Get inviter details for email
        const inviter = await models.User.findByPk(inviterId);
        if (!inviter) {
            res.status(404).json({ message: "Inviter not found" });
            return;
        }

        // Create the contact invitation
        const contact = await models.Contact.create({
            id: uuidv4(),
            inviterId,
            inviteeId,
            status: ContactStatus.PENDING,
            invitedAt: new Date()
        });

        // Generate response token for the invitation
        const invitationToken = uuidv4();

        // Create accept and reject URLs
        const acceptUrl = `${process.env.FRONTEND_URL}/contacts/respond?token=${invitationToken}&action=accept&contactId=${contact.id}`;
        const rejectUrl = `${process.env.FRONTEND_URL}/contacts/respond?token=${invitationToken}&action=reject&contactId=${contact.id}`;

        // Send invitation email to invitee
        try {
            await sendEmail({
                to: invitee.email,
                subject: `Contact Invitation from ${inviter.firstName} ${inviter.lastName}`,
                type: 'contact_invitation',
                data: {
                    inviterName: `${inviter.firstName} ${inviter.lastName}`,
                    inviterEmail: inviter.email,
                    acceptUrl,
                    rejectUrl,
                    contactId: contact.id
                }
            });
        } catch (emailError) {
            console.error("Failed to send invitation email:", emailError);
            // Optionally delete the created contact if email fails
            await contact.destroy();
            res.status(500).json({ message: "Failed to send invitation email" });
            return;
        }

        res.status(201).json({
            message: "Invitation sent successfully",
            data: {
                id: contact.id,
                inviterId: contact.inviterId,
                inviteeId: contact.inviteeId,
                inviteeName: `${invitee.firstName} ${invitee.lastName}`,
                inviteeEmail: invitee.email,
                status: contact.status,
                invitedAt: contact.invitedAt
            }
        });
        return;
    } catch (error) {
        console.error("Invite contact error:", error);
        next(error);
    }
};

const respondToInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { contactId } = req.params; // Get contactId from URL params
        const { action } = req.body; // action: 'accept' or 'reject'
        const userId = req.user.id;

        if (!contactId || !action) {
            res.status(400).json({ message: "Contact ID and action are required" });
            return;
        }

        // Rest of the controller remains the same...
        if (!['accept', 'reject'].includes(action)) {
            res.status(400).json({ message: "Action must be 'accept' or 'reject'" });
            return;
        }

        const models = req.app.get('models') as ReturnType<typeof Models>;

        // Find the contact invitation
        const contact = await models.Contact.findOne({
            where: {
                id: contactId,
                inviteeId: userId,
                status: ContactStatus.PENDING
            },
            include: [
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        if (!contact) {
            res.status(404).json({ message: "Invitation not found or already responded to" });
            return;
        }

        // Update the contact status
        const newStatus = action === 'accept' ? ContactStatus.ACCEPTED : ContactStatus.REJECTED;
        await contact.update({
            status: newStatus,
            respondedAt: new Date()
        });

        // Get current user details for email notification
        const currentUser = await models.User.findByPk(userId);
        if (!currentUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Send notification email to the inviter
        try {
            const emailData = {
                responderName: `${currentUser.firstName} ${currentUser.lastName}`,
                responderEmail: currentUser.email,
                action: action,
                actionText: action === 'accept' ? 'accepted' : 'rejected'
            };

            await sendEmail({
                to: contact.inviter.email,
                subject: `Contact Invitation ${action === 'accept' ? 'Accepted' : 'Rejected'} by ${currentUser.firstName} ${currentUser.lastName}`,
                type: 'invitation_response',
                data: emailData
            });
        } catch (emailError) {
            console.error("Failed to send response notification email:", emailError);
            // Don't fail the request if email fails, just log it
        }

        const message = action === 'accept'
            ? "Contact invitation accepted successfully"
            : "Contact invitation rejected";

        res.status(200).json({
            message,
            data: {
                id: contact.id,
                inviterId: contact.inviterId,
                inviteeId: contact.inviteeId,
                status: contact.status,
                respondedAt: contact.respondedAt,
                inviterName: `${contact.inviter.firstName} ${contact.inviter.lastName}`
            }
        });
        return;
    } catch (error) {
        console.error("Respond to invitation error:", error);
        next(error);
    }
};


const getContacts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const { status, type } = req.query;

        const models = req.app.get('models') as ReturnType<typeof Models>;

        let whereClause: any = {
            [Op.or]: [
                { inviterId: userId },
                { inviteeId: userId }
            ]
        };

        // Filter by status if provided
        if (status && Object.values(ContactStatus).includes(status as ContactStatus)) {
            whereClause.status = status;
        }

        // Filter by type (sent/received) if provided
        if (type === 'sent') {
            whereClause = { inviterId: userId, ...whereClause };
            delete whereClause[Op.or];
        } else if (type === 'received') {
            whereClause = { inviteeId: userId, ...whereClause };
            delete whereClause[Op.or];
        }

        const contacts = await models.Contact.findAll({
            where: whereClause,
            include: [
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                },
                {
                    model: models.User,
                    as: 'invitee',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        // Transform data to make it more user-friendly
        const transformedContacts = contacts.map(contact => {
            const isInviter = contact.inviterId === userId;
            const otherUser = isInviter ? contact.invitee : contact.inviter;

            return {
                id: contact.id,
                contactUser: {
                    id: otherUser.id,
                    firstName: otherUser.firstName,
                    lastName: otherUser.lastName,
                    email: otherUser.email,
                    phone: otherUser.phone,
                    publicId: otherUser.publicId
                },
                status: contact.status,
                relationship: isInviter ? 'sent' : 'received',
                invitedAt: contact.invitedAt,
                respondedAt: contact.respondedAt
            };
        });

        res.status(200).json({
            message: "Contacts retrieved successfully",
            data: transformedContacts,
            total: transformedContacts.length
        });
        return;
    } catch (error) {
        console.error("Get contacts error:", error);
        next(error);
    }
};

// Get pending invitations (both sent and received)
const getPendingInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const models = req.app.get('models') as ReturnType<typeof Models>;

        const sentInvitations = await models.Contact.findAll({
            where: {
                inviterId: userId,
                status: ContactStatus.PENDING
            },
            include: [
                {
                    model: models.User,
                    as: 'invitee',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        const receivedInvitations = await models.Contact.findAll({
            where: {
                inviteeId: userId,
                status: ContactStatus.PENDING
            },
            include: [
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        res.status(200).json({
            message: "Pending invitations retrieved successfully",
            data: {
                sent: sentInvitations.map(inv => ({
                    id: inv.id,
                    invitee: inv.invitee,
                    invitedAt: inv.invitedAt
                })),
                received: receivedInvitations.map(inv => ({
                    id: inv.id,
                    inviter: inv.inviter,
                    invitedAt: inv.invitedAt
                }))
            }
        });
        return;
    } catch (error) {
        console.error("Get pending invitations error:", error);
        next(error);
    }
};

const getAcceptedContacts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user.id;
        const models = req.app.get('models') as ReturnType<typeof Models>;

        const contacts = await models.Contact.findAll({
            where: {
                [Op.or]: [
                    { inviterId: userId },
                    { inviteeId: userId }
                ],
                status: ContactStatus.ACCEPTED
            },
            include: [
                {
                    model: models.User,
                    as: 'inviter',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                },
                {
                    model: models.User,
                    as: 'invitee',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'publicId']
                }
            ],
            order: [['invitedAt', 'DESC']]
        });

        const transformedContacts = contacts.map(contact => {
            const isInviter = contact.inviterId === userId;
            const otherUser = isInviter ? contact.invitee : contact.inviter;

            return {
                id: contact.id,
                contactUser: {
                    id: otherUser.id,
                    firstName: otherUser.firstName,
                    lastName: otherUser.lastName,
                    email: otherUser.email,
                    phone: otherUser.phone,
                    publicId: otherUser.publicId
                },
                status: contact.status,
                invitedAt: contact.invitedAt,
                respondedAt: contact.respondedAt
            };
        });

        res.status(200).json({
            message: "Accepted contacts retrieved successfully",
            data: transformedContacts,
            total: transformedContacts.length
        });
    } catch (error) {
        console.error("Get accepted contacts error:", error);
        next(error);
    }
};

export {
    inviteContact,
    respondToInvitation,
    getContacts,
    getPendingInvitations,
    getAcceptedContacts
};
