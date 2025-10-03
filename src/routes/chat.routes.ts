import { Router } from "express";
import {
  getGroupChat,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  updateChatSettings,
  getChatSettings,
  uploadFile
} from "../controllers/chatController";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Group Chat
 *   description: Group chat management endpoints
 */

/**
 * @swagger
 * /api/groups/{groupId}/chat:
 *   get:
 *     summary: Get group chat details
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group chat retrieved successfully
 *       403:
 *         description: Not a member of the group
 *       404:
 *         description: Group not found
 */
router.get("/groups/:groupId/chat", authenticate, getGroupChat);

/**
 * @swagger
 * /api/groups/{groupId}/chat/messages:
 *   get:
 *     summary: Get chat messages for a group
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages per page
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Get messages before this message ID
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *         description: Get messages after this message ID
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       403:
 *         description: Not a member of the group
 */
router.get("/groups/:groupId/chat/messages", authenticate, getMessages);

/**
 * @swagger
 * /api/groups/{groupId}/chat/messages:
 *   post:
 *     summary: Send a message to group chat
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *               messageType:
 *                 type: string
 *                 enum: [text, image, file, money, system, announcement]
 *                 default: text
 *               transactionId:
 *                 type: string
 *                 description: Transaction ID for money messages
 *               metadata:
 *                 type: object
 *                 description: Additional message metadata
 *               replyToMessageId:
 *                 type: string
 *                 description: ID of message being replied to
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid message content
 *       403:
 *         description: Not authorized to send messages
 *       429:
 *         description: Rate limited (slow mode)
 */
router.post("/groups/:groupId/chat/messages", authenticate, sendMessage);

/**
 * @swagger
 * /api/groups/{groupId}/chat/messages/{messageId}:
 *   put:
 *     summary: Edit a chat message
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: New message content
 *     responses:
 *       200:
 *         description: Message edited successfully
 *       403:
 *         description: Not authorized to edit this message
 *       404:
 *         description: Message not found
 */
router.put("/groups/:groupId/chat/messages/:messageId", authenticate, editMessage);

/**
 * @swagger
 * /api/groups/{groupId}/chat/messages/{messageId}:
 *   delete:
 *     summary: Delete a chat message
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       403:
 *         description: Not authorized to delete this message
 *       404:
 *         description: Message not found
 */
router.delete("/groups/:groupId/chat/messages/:messageId", authenticate, deleteMessage);

/**
 * @swagger
 * /api/groups/{groupId}/chat/read:
 *   post:
 *     summary: Mark messages as read
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of message IDs to mark as read
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 *       403:
 *         description: Not a member of the group
 */
router.post("/groups/:groupId/chat/read", authenticate, markAsRead);

/**
 * @swagger
 * /api/groups/{groupId}/chat/settings:
 *   get:
 *     summary: Get group chat settings
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Chat settings retrieved successfully
 *       403:
 *         description: Not a member of the group
 */
router.get("/groups/:groupId/chat/settings", authenticate, getChatSettings);

/**
 * @swagger
 * /api/groups/{groupId}/chat/settings:
 *   put:
 *     summary: Update group chat settings
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               canMembersInvite:
 *                 type: boolean
 *               canMembersDeleteMessages:
 *                 type: boolean
 *               onlyAdminsCanPost:
 *                 type: boolean
 *               messageRetentionDays:
 *                 type: integer
 *               allowFileSharing:
 *                 type: boolean
 *               allowMoneyTransfers:
 *                 type: boolean
 *               maxFileSize:
 *                 type: integer
 *               allowedFileTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               profanityFilter:
 *                 type: boolean
 *               linkPreview:
 *                 type: boolean
 *               readReceipts:
 *                 type: boolean
 *               typingIndicators:
 *                 type: boolean
 *               slowMode:
 *                 type: integer
 *               announcementMode:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Chat settings updated successfully
 *       403:
 *         description: Only owners and admins can update settings
 */
router.put("/groups/:groupId/chat/settings", authenticate, updateChatSettings);

/**
 * @swagger
 * /api/groups/{groupId}/chat/upload:
 *   post:
 *     summary: Upload file to group chat
 *     tags: [Group Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file or file too large
 *       403:
 *         description: File sharing not allowed in this group
 */
router.post("/groups/:groupId/chat/upload", authenticate, uploadFile);

export default router;