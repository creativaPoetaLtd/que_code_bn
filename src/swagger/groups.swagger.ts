/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the group
 *         name:
 *           type: string
 *           description: Name of the group
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Description of the group
 *           maxLength: 500
 *         picture:
 *           type: string
 *           description: URL or base64 string of the group's profile picture
 *         ownerId:
 *           type: string
 *           format: uuid
 *           description: ID of the group owner
 *         ownerName:
 *           type: string
 *           description: Full name of the group owner
 *         qrCode:
 *           type: string
 *           description: Base64 encoded QR code for joining the group
 *         accessLink:
 *           type: string
 *           description: Link for joining the group
 *         isPrivate:
 *           type: boolean
 *           description: Whether the group is private or public
 *           default: false
 *         maxMembers:
 *           type: integer
 *           description: Maximum number of members allowed in the group
 *           minimum: 2
 *           maximum: 1000
 *           default: 100
 *         memberCount:
 *           type: integer
 *           description: Current number of members in the group
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the group was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the group was last updated
 *         userRole:
 *           type: string
 *           enum: [owner, admin, member]
 *           description: Current user's role in the group
 *         userStatus:
 *           type: string
 *           enum: [pending, active, left, removed]
 *           description: Current user's status in the group
 *
 *     GroupMember:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the membership
 *         userId:
 *           type: string
 *           format: uuid
 *           description: ID of the user
 *         userName:
 *           type: string
 *           description: Full name of the user
 *         userEmail:
 *           type: string
 *           format: email
 *           description: Email of the user
 *         role:
 *           type: string
 *           enum: [owner, admin, member]
 *           description: Role of the user in the group
 *         status:
 *           type: string
 *           enum: [pending, active, left, removed]
 *           description: Status of the user in the group
 *         joinedAt:
 *           type: string
 *           format: date-time
 *           description: When the user joined the group
 *         invitedAt:
 *           type: string
 *           format: date-time
 *           description: When the user was invited to the group
 *         invitedByName:
 *           type: string
 *           description: Name of the user who invited this member
 *
 *     GroupJoinRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the join request
 *         groupId:
 *           type: string
 *           format: uuid
 *           description: ID of the group
 *         userId:
 *           type: string
 *           format: uuid
 *           description: ID of the requesting user
 *         userName:
 *           type: string
 *           description: Full name of the requesting user
 *         userEmail:
 *           type: string
 *           format: email
 *           description: Email of the requesting user
 *         message:
 *           type: string
 *           description: Optional message from the requesting user
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Status of the join request
 *         requestedAt:
 *           type: string
 *           format: date-time
 *           description: When the request was made
 *         respondedAt:
 *           type: string
 *           format: date-time
 *           description: When the request was responded to
 *
 *     CreateGroupRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the group
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Description of the group
 *           maxLength: 500
 *         picture:
 *           type: string
 *           description: URL or base64 string of the group's profile picture
 *         isPrivate:
 *           type: boolean
 *           description: Whether the group is private or public
 *           default: false
 *         maxMembers:
 *           type: integer
 *           description: Maximum number of members allowed
 *           minimum: 2
 *           maximum: 1000
 *           default: 100
 *         memberIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of user IDs to invite to the group
 *
 *     UpdateGroupRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the group
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Description of the group
 *           maxLength: 500
 *         picture:
 *           type: string
 *           description: URL or base64 string of the group's profile picture
 *         isPrivate:
 *           type: boolean
 *           description: Whether the group is private or public
 *         maxMembers:
 *           type: integer
 *           description: Maximum number of members allowed
 *           minimum: 2
 *           maximum: 1000
 *
 *     InviteToGroupRequest:
 *       type: object
 *       required:
 *         - groupId
 *         - memberIds
 *       properties:
 *         groupId:
 *           type: string
 *           format: uuid
 *           description: ID of the group to invite users to
 *         memberIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of user IDs to invite
 *           minItems: 1
 *
 *     RespondToInvitationRequest:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [accept, reject]
 *           description: Action to take on the invitation
 *
 *     JoinGroupByLinkRequest:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: Access token from the group link
 *         qrCodeData:
 *           type: string
 *           description: QR code data for joining
 *
 *     RequestToJoinGroupRequest:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Optional message for the join request
 *           maxLength: 500
 *
 *     RespondToJoinRequestRequest:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [accept, reject]
 *           description: Action to take on the join request
 *
 *     GroupListResponse:
 *       type: object
 *       properties:
 *         groups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Group'
 *         total:
 *           type: integer
 *           description: Total number of groups
 *         page:
 *           type: integer
 *           description: Current page number
 *         limit:
 *           type: integer
 *           description: Number of groups per page
 *
 * /groups:
 *   get:
 *     summary: Get user's groups
 *     description: Retrieve all groups that the authenticated user is a member of, with pagination support
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of groups per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [owner, admin, member]
 *         description: Filter groups by user's role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, left, removed]
 *         description: Filter groups by user's status
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GroupListResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a new group
 *     description: Create a new group with the authenticated user as the owner
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupRequest'
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}:
 *   get:
 *     summary: Get group details
 *     description: Retrieve detailed information about a specific group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 *   put:
 *     summary: Update group information
 *     description: Update group details (only accessible to group owner and admins)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGroupRequest'
 *     responses:
 *       200:
 *         description: Group updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 *   delete:
 *     summary: Delete a group
 *     description: Delete a group (only accessible to group owner)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group deleted successfully
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
 *         description: Not authorized to delete this group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}/members:
 *   get:
 *     summary: Get group members
 *     description: Retrieve all members of a specific group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
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
 *         description: Number of members per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [owner, admin, member]
 *         description: Filter members by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, left, removed]
 *         description: Filter members by status
 *     responses:
 *       200:
 *         description: Group members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GroupMember'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view group members
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 * /groups/invite:
 *   post:
 *     summary: Invite users to a group
 *     description: Send invitations to users to join a group (accessible to group owner and admins)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteToGroupRequest'
 *     responses:
 *       200:
 *         description: Invitations sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     successful:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of user IDs successfully invited
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           reason:
 *                             type: string
 *                       description: List of failed invitations with reasons
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to invite users to this group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 * /groups/respond/{membershipId}:
 *   post:
 *     summary: Respond to group invitation
 *     description: Accept or reject a group invitation
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: membershipId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Membership/Invitation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RespondToInvitationRequest'
 *     responses:
 *       200:
 *         description: Response recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GroupMember'
 *       400:
 *         description: Bad request - invalid action
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Internal server error
 *
 * /groups/join:
 *   post:
 *     summary: Join group by link or QR code
 *     description: Join a group using an access link or QR code
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JoinGroupByLinkRequest'
 *     responses:
 *       200:
 *         description: Successfully joined the group
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request - invalid token or already a member
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Group not found or invalid token
 *       409:
 *         description: Group is full or user already a member
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}/leave:
 *   post:
 *     summary: Leave a group
 *     description: Leave a group (members can leave, but owners must transfer ownership first)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Successfully left the group
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - owner cannot leave without transferring ownership
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Group not found or user not a member
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}/members/{memberId}:
 *   delete:
 *     summary: Remove member from group
 *     description: Remove a member from the group (accessible to group owner and admins)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Member ID (user ID)
 *     responses:
 *       200:
 *         description: Member removed successfully
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
 *         description: Not authorized to remove members from this group
 *       404:
 *         description: Group or member not found
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}/requests:
 *   get:
 *     summary: Get join requests for a group
 *     description: Retrieve all pending join requests for a group (accessible to group owner and admins)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           default: pending
 *         description: Filter requests by status
 *     responses:
 *       200:
 *         description: Join requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GroupJoinRequest'
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view join requests for this group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Request to join a group
 *     description: Send a request to join a private group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestToJoinGroupRequest'
 *     responses:
 *       201:
 *         description: Join request sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GroupJoinRequest'
 *       400:
 *         description: Bad request - already a member or request already exists
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Group not found
 *       409:
 *         description: Group is full or request already exists
 *       500:
 *         description: Internal server error
 *
 * /groups/{groupId}/requests/{requestId}/respond:
 *   post:
 *     summary: Respond to join request
 *     description: Accept or reject a join request (accessible to group owner and admins)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Join request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RespondToJoinRequestRequest'
 *     responses:
 *       200:
 *         description: Response recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GroupJoinRequest'
 *       400:
 *         description: Bad request - invalid action or request already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to respond to join requests for this group
 *       404:
 *         description: Group or request not found
 *       500:
 *         description: Internal server error
 */
