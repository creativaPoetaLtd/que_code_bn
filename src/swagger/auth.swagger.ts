/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Authentication endpoints for login and logout
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           description: User password
 *           example: "SecurePassword123"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Login successful"
 *         user:
 *           oneOf:
 *             - $ref: '#/components/schemas/User'
 *             - $ref: '#/components/schemas/Organization'
 *         token:
 *           type: string
 *           description: JWT access token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         accountType:
 *           type: string
 *           enum: [user, organization]
 *           description: Type of account that logged in
 *           example: "user"
 *
 *     Organization:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the organization
 *         name:
 *           type: string
 *           description: Organization name
 *         email:
 *           type: string
 *           format: email
 *           description: Organization email address
 *         phone:
 *           type: string
 *           description: Organization phone number
 *         website:
 *           type: string
 *           description: Organization website URL
 *         description:
 *           type: string
 *           description: Organization description
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Organization active status
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user or organization
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Bad request - missing or invalid email/password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email and password are required"
 *       401:
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid credentials"
 *       403:
 *         description: Forbidden - account not verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Account not verified. Please verify your email before logging in."
 *                 requiresVerification:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Not found - account does not exist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Account not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "An error occurred during login"
 *                 error:
 *                   type: string
 *                   description: Error details
 */
