/**
 * @swagger
 * components:
 *   schemas:
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Chat ID
 *         isGroup:
 *           type: boolean
 *           description: Whether this is a group chat
 *           default: false
 *         groupName:
 *           type: string
 *           nullable: true
 *           description: Name of the group (for group chats)
 *         groupDescription:
 *           type: string
 *           nullable: true
 *           description: Description of the group (for group chats)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         participants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatParticipant'
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174000"
 *         isGroup: false
 *         groupName: null
 *         groupDescription: null
 *         createdAt: "2025-09-06T10:00:00.000Z"
 *         updatedAt: "2025-09-06T10:30:00.000Z"
 *
 *     ChatParticipant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         chatId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         joinedAt:
 *           type: string
 *           format: date-time
 *         lastReadAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         user:
 *           $ref: '#/components/schemas/UserProfile'
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174001"
 *         chatId: "123e4567-e89b-12d3-a456-426614174000"
 *         userId: "123e4567-e89b-12d3-a456-426614174002"
 *         joinedAt: "2025-09-06T10:00:00.000Z"
 *         lastReadAt: "2025-09-06T10:25:00.000Z"
 *
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         chatId:
 *           type: string
 *           format: uuid
 *         senderId:
 *           type: string
 *           format: uuid
 *         content:
 *           type: string
 *           description: Message content
 *         messageType:
 *           type: string
 *           enum: [text, image, file, money]
 *           default: text
 *         isEdited:
 *           type: boolean
 *           default: false
 *         editedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         sender:
 *           $ref: '#/components/schemas/UserProfile'
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174003"
 *         chatId: "123e4567-e89b-12d3-a456-426614174000"
 *         senderId: "123e4567-e89b-12d3-a456-426614174002"
 *         content: "Hello, how are you?"
 *         messageType: "text"
 *         isEdited: false
 *         editedAt: null
 *         createdAt: "2025-09-06T10:15:00.000Z"
 *
 *     CreateChatRequest:
 *       type: object
 *       required:
 *         - userId2
 *       properties:
 *         userId2:
 *           type: string
 *           format: uuid
 *           description: ID of the other user to chat with
 *       example:
 *         userId2: "123e4567-e89b-12d3-a456-426614174002"
 *
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - chatId
 *         - senderId
 *         - content
 *       properties:
 *         chatId:
 *           type: string
 *           format: uuid
 *           description: ID of the chat
 *         senderId:
 *           type: string
 *           format: uuid
 *           description: ID of the message sender
 *         content:
 *           type: string
 *           description: Message content
 *         messageType:
 *           type: string
 *           enum: [text, image, file, money]
 *           default: text
 *           description: Type of message
 *       example:
 *         chatId: "123e4567-e89b-12d3-a456-426614174000"
 *         senderId: "123e4567-e89b-12d3-a456-426614174002"
 *         content: "Hello, how are you?"
 *         messageType: "text"
 *
 *     UpdateLastReadRequest:
 *       type: object
 *       required:
 *         - chatId
 *         - userId
 *       properties:
 *         chatId:
 *           type: string
 *           format: uuid
 *           description: ID of the chat
 *         userId:
 *           type: string
 *           format: uuid
 *           description: ID of the user
 *       example:
 *         chatId: "123e4567-e89b-12d3-a456-426614174000"
 *         userId: "123e4567-e89b-12d3-a456-426614174002"
 *
 *   responses:
 *     ChatResponse:
 *       description: Single chat with details
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               data:
 *                 $ref: '#/components/schemas/Chat'
 *               isNew:
 *                 type: boolean
 *                 description: Whether this is a newly created chat
 *
 *     ChatsResponse:
 *       description: List of user's chats
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
 *                   $ref: '#/components/schemas/Chat'
 *
 *     MessagesResponse:
 *       description: List of chat messages
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
 *                   $ref: '#/components/schemas/ChatMessage'
 *
 *     MessageResponse:
 *       description: Single message
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               data:
 *                 $ref: '#/components/schemas/ChatMessage'
 */

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Create or get existing chat
 *     description: Create a new chat or get existing chat between two users. Both users must be contacts.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatRequest'
 *     responses:
 *       200:
 *         description: Chat found or created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/ChatResponse'
 *                 - type: object
 *                   properties:
 *                     isNew:
 *                       type: boolean
 *                       example: false
 *       201:
 *         description: New chat created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/ChatResponse'
 *                 - type: object
 *                   properties:
 *                     isNew:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missing_users: "Both user IDs are required"
 *                     self_chat: "Cannot create chat with yourself"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Users are not contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "You can only chat with users who are in your contacts. Please send them a friend invitation first."
 *       404:
 *         description: One or both users not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "One or both users not found"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: Get user's chats
 *     description: Retrieve all chats for the authenticated user
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/ChatsResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/chats/{chatId}/messages:
 *   get:
 *     summary: Get chat messages
 *     description: Retrieve messages for a specific chat with pagination
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         description: ID of the chat
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: Number of messages per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         $ref: '#/components/responses/MessagesResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/chats/messages/send:
 *   post:
 *     summary: Send a message
 *     description: Send a message to a chat. Note - Real-time messaging is handled via Socket.IO.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         $ref: '#/components/responses/MessageResponse'
 *       400:
 *         description: Bad request - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chat ID, sender ID, and content are required"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Chat not found or user not participant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chat not found or user not participant"
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/chats/messages/read:
 *   post:
 *     summary: Update last read timestamp
 *     description: Mark messages as read by updating the last read timestamp for a user in a chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLastReadRequest'
 *     responses:
 *       200:
 *         description: Last read timestamp updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Last read updated successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
