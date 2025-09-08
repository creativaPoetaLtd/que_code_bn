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
 *           description: Unique identifier for the contact relationship
 *         userAId:
 *           type: string
 *           format: uuid
 *           description: ID of the first user in the contact relationship
 *         userBId:
 *           type: string
 *           format: uuid
 *           description: ID of the second user in the contact relationship
 *         status:
 *           type: string
 *           enum: [active, blocked]
 *           description: Status of the contact relationship
 *         otherUser:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the contact relationship was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the contact relationship was last updated
 *
 *     ContactStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of contacts
 *         active:
 *           type: integer
 *           description: Number of active contacts
 *         blocked:
 *           type: integer
 *           description: Number of blocked contacts
 *
 *     UserWithRelationship:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           properties:
 *             relationshipStatus:
 *               type: string
 *               enum: [none, active, blocked, pending_invitation]
 *               description: Current relationship status with the user
 *
 *     ContactCreateRequest:
 *       type: object
 *       required:
 *         - userBId
 *       properties:
 *         userBId:
 *           type: string
 *           format: uuid
 *           description: ID of the user to add as contact
 *
 *     ContactUpdateRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, blocked]
 *           description: New status for the contact
 *
 * /contacts:
 *   get:
 *     summary: Get user's contacts
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, blocked]
 *         description: Filter contacts by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of contacts per page
 *     responses:
 *       200:
 *         description: List of contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *                 totalCount:
 *                   type: integer
 *                   description: Total number of contacts
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactCreateRequest'
 *     responses:
 *       201:
 *         description: Contact created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * /contacts/search:
 *   get:
 *     summary: Search for users to add as contacts
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query for user names or email
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Users found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserWithRelationship'
 *       400:
 *         description: Bad request - search query required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * /contacts/stats:
 *   get:
 *     summary: Get contact statistics
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactStats'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * /contacts/{id}:
 *   get:
 *     summary: Get a specific contact by ID
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Contact retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this contact
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 *
 *   put:
 *     summary: Update contact status (block/unblock)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactUpdateRequest'
 *     responses:
 *       200:
 *         description: Contact status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Bad request - invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this contact
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Remove a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to remove this contact
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */