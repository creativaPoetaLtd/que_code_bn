/**
 * @swagger
 * components:
 *   schemas:
 *     Contact:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Contact relationship ID
 *         userAId:
 *           type: string
 *           format: uuid
 *           description: First user ID
 *         userBId:
 *           type: string
 *           format: uuid
 *           description: Second user ID
 *         status:
 *           type: string
 *           enum: [active, blocked]
 *           description: Contact relationship status
 *         createdAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174000"
 *         userAId: "123e4567-e89b-12d3-a456-426614174001"
 *         userBId: "123e4567-e89b-12d3-a456-426614174002"
 *         status: "active"
 *         createdAt: "2025-09-06T10:00:00.000Z"
 *
 *     ContactUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         contactUser:
 *           $ref: '#/components/schemas/UserProfile'
 *         status:
 *           type: string
 *           enum: [active, blocked]
 *         createdAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174000"
 *         contactUser:
 *           id: "123e4567-e89b-12d3-a456-426614174002"
 *           firstName: "John"
 *           lastName: "Doe"
 *           email: "john.doe@example.com"
 *         status: "active"
 *         createdAt: "2025-09-06T10:00:00.000Z"
 *
 *     AvailableUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         relationshipStatus:
 *           type: string
 *           enum: [available, invitation_sent, invitation_received, declined]
 *         actionText:
 *           type: string
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174003"
 *         firstName: "Jane"
 *         lastName: "Smith"
 *         email: "jane.smith@example.com"
 *         relationshipStatus: "available"
 *         actionText: "Send Invitation"
 *
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174002"
 *         firstName: "John"
 *         lastName: "Doe"
 *         email: "john.doe@example.com"
 *
 *   responses:
 *     ContactsResponse:
 *       description: List of user contacts
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
 *                   $ref: '#/components/schemas/ContactUser'
 *
 *     AvailableUsersResponse:
 *       description: List of available users for invitations
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
 *                   $ref: '#/components/schemas/AvailableUser'
 */

/**
 * @swagger
 * /contacts:
 *   get:
 *     summary: Get user's contacts
 *     description: Retrieve all active contacts for the authenticated user
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/ContactsResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

/**
 * @swagger
 * /api/contacts/available:
 *   get:
 *     summary: Get available users for invitations
 *     description: Retrieve all verified users with their relationship status to determine invitation possibilities
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AvailableUsersResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

/**
 * @swagger
 * /api/contacts/{contactUserId}:
 *   delete:
 *     summary: Remove a contact
 *     description: Block a contact relationship (preserves chat history)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactUserId
 *         required: true
 *         description: ID of the user to remove from contacts
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Contact removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact removed successfully"
 *       400:
 *         description: Bad request - Missing contact user ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact user ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Contact relationship not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contact relationship not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
