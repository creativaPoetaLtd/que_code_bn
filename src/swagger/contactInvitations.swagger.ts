/**
 * @swagger
 * components:
 *   schemas:
 *     ContactInvitation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Invitation ID
 *         inviterId:
 *           type: string
 *           format: uuid
 *           description: ID of user who sent the invitation
 *         inviteeId:
 *           type: string
 *           format: uuid
 *           description: ID of user who received the invitation
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined, expired]
 *           description: Current status of the invitation
 *         invitationToken:
 *           type: string
 *           description: Unique token for email-based responses
 *         invitedAt:
 *           type: string
 *           format: date-time
 *           description: When the invitation was sent
 *         respondedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the invitation was responded to
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the invitation expires
 *         inviter:
 *           $ref: '#/components/schemas/UserProfile'
 *         invitee:
 *           $ref: '#/components/schemas/UserProfile'
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174000"
 *         inviterId: "123e4567-e89b-12d3-a456-426614174001"
 *         inviteeId: "123e4567-e89b-12d3-a456-426614174002"
 *         status: "pending"
 *         invitationToken: "abc123def456"
 *         invitedAt: "2025-09-06T10:00:00.000Z"
 *         respondedAt: null
 *         expiresAt: "2025-09-13T10:00:00.000Z"
 *
 *     SendInvitationRequest:
 *       type: object
 *       required:
 *         - inviteeId
 *       properties:
 *         inviteeId:
 *           type: string
 *           format: uuid
 *           description: ID of the user to invite
 *       example:
 *         inviteeId: "123e4567-e89b-12d3-a456-426614174002"
 *
 *   responses:
 *     InvitationsResponse:
 *       description: List of contact invitations
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               data:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ContactInvitation'
 *
 *     InvitationResponse:
 *       description: Single contact invitation
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               data:
 *                 $ref: '#/components/schemas/ContactInvitation'
 */

/**
 * @swagger
 * /api/contact-invitations/send:
 *   post:
 *     summary: Send a contact invitation
 *     description: Send an invitation to another user to become contacts. An email notification will be sent to the invitee.
 *     tags: [Contact Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendInvitationRequest'
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact invitation sent successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ContactInvitation'
 *       400:
 *         description: Bad request - Invalid data or existing relationship
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missing_invitee: "Invitee ID is required"
 *                     self_invite: "Cannot invite yourself"
 *                     already_contacts: "Already contacts"
 *                     pending_invitation: "Invitation already pending"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/{invitationId}/accept:
 *   put:
 *     summary: Accept a contact invitation
 *     description: Accept a pending contact invitation. Creates a contact relationship and sends email notification to inviter.
 *     tags: [Contact Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         description: ID of the invitation to accept
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact invitation accepted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invitation expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation has expired"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Invitation not found or already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation not found or already processed"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/{invitationId}/decline:
 *   put:
 *     summary: Decline a contact invitation
 *     description: Decline a pending contact invitation. Sends email notification to inviter.
 *     tags: [Contact Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         description: ID of the invitation to decline
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact invitation declined successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Invitation not found or already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation not found or already processed"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/pending:
 *   get:
 *     summary: Get pending invitations (received)
 *     description: Retrieve all pending invitations received by the authenticated user
 *     tags: [Contact Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/InvitationsResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/sent:
 *   get:
 *     summary: Get sent invitations
 *     description: Retrieve all invitations sent by the authenticated user
 *     tags: [Contact Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/InvitationsResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/verify/{token}:
 *   get:
 *     summary: Verify invitation token (Public)
 *     description: Verify an invitation token from email link. No authentication required.
 *     tags: [Contact Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Invitation token from email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation verified successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ContactInvitation'
 *       400:
 *         description: Missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation token is required"
 *       404:
 *         description: Invitation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation not found"
 *       410:
 *         description: Invitation expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation has expired"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/accept/{token}:
 *   post:
 *     summary: Accept invitation via token (Public)
 *     description: Accept an invitation using token from email link. No authentication required.
 *     tags: [Contact Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Invitation token from email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation accepted successfully"
 *       400:
 *         description: Bad request - Missing token or already responded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missing_token: "Invitation token is required"
 *                     already_responded: "Invitation has already been accepted"
 *       404:
 *         description: Invitation not found
 *       410:
 *         description: Invitation expired
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/contact-invitations/decline/{token}:
 *   post:
 *     summary: Decline invitation via token (Public)
 *     description: Decline an invitation using token from email link. No authentication required.
 *     tags: [Contact Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Invitation token from email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation declined successfully"
 *       400:
 *         description: Bad request - Missing token or already responded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missing_token: "Invitation token is required"
 *                     already_responded: "Invitation has already been declined"
 *       404:
 *         description: Invitation not found
 *       410:
 *         description: Invitation expired
 *       500:
 *         description: Internal server error
 */
