/**
 * @swagger
 * tags:
 *   name: Organizations
 *   description: Organization management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrganizationCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the category
 *         name:
 *           type: string
 *           description: Category name
 *         description:
 *           type: string
 *           description: Category description
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Organization:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - type
 *         - email
 *         - ownerName
 *         - ownerPhone
 *         - ownerEmail
 *         - contactPhone
 *         - tinNumber
 *         - approvalStatus
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the organization
 *         name:
 *           type: string
 *           description: Organization name
 *         type:
 *           type: string
 *           description: Organization type
 *         email:
 *           type: string
 *           format: email
 *           description: Organization email
 *         ownerName:
 *           type: string
 *           description: Organization owner name
 *         ownerPhone:
 *           type: string
 *           description: Organization owner phone number
 *         ownerEmail:
 *           type: string
 *           format: email
 *           description: Organization owner email
 *         contactPhone:
 *           type: string
 *           description: Organization contact phone number
 *         tinNumber:
 *           type: string
 *           description: Tax Identification Number
 *        
 *         # Note: Location fields (province, district, sector, cell) and document fields (logo, operationalDocument) are now stored in the Profile model
 *         approvalStatus:
 *           type: boolean
 *           description: Organization approval status
 *         categoryId:
 *           type: string
 *           format: uuid
 *           description: Organization category ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         Category:
 *           $ref: '#/components/schemas/OrganizationCategory'
 *
 *     OrganizationResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Organization created successfully"
 *         data:
 *           $ref: '#/components/schemas/Organization'
 */

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     # security:
 *     #   - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - email
 *               - ownerName
 *               - ownerPhone
 *               - ownerEmail
 *               - contactPhone
 *               - tinNumber
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization name
 *                 example: "Tech Solutions Ltd"
 *               type:
 *                 type: string
 *                 description: Organization type
 *                 example: "company"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Organization email
 *                 example: "info@techsolutions.com"
 *               ownerName:
 *                 type: string
 *                 description: Organization owner name
 *                 example: "John Doe"
 *               ownerPhone:
 *                 type: string
 *                 description: Organization owner phone number
 *                 example: "+1234567890"
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *                 description: Organization owner email
 *                 example: "john.doe@example.com"
 *               contactPhone:
 *                 type: string
 *                 description: Organization contact phone number
 *                 example: "+1234567891"
 *               tinNumber:
 *                 type: string
 *                 description: Tax Identification Number
 *                 example: "1234567890"
 *               # Note: Location fields (province, district, sector, cell) and document fields (logo, operationalDocument) are now handled in the Profile model
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Organization password
 *                 example: "SecurePassword123!"
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: Organization category ID
 *                 example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationResponse'
 *             example:
 *               message: "Organization created successfully"
 *               data:
 *                 id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                 name: "Tech Solutions Ltd"
 *                 type: "company"
 *                 email: "info@techsolutions.com"
 *                 ownerName: "John Doe"
 *                 ownerPhone: "+1234567890"
 *                 ownerEmail: "john.doe@example.com"
 *                 contactPhone: "+1234567891"
 *                 tinNumber: "1234567890"
 *                 # Location and document fields are now in the Profile model
 *                 approvalStatus: false
 *                 categoryId: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                 createdAt: "2025-08-22T06:59:11.842Z"
 *                 updatedAt: "2025-08-22T06:59:11.842Z"
 *                 Category:
 *                   id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                   name: "Technology"
 *                   description: "Technology companies and startups"
 *                   createdAt: "2025-08-22T06:59:11.842Z"
 *                   updatedAt: "2025-08-22T06:59:11.842Z"
 *       400:
 *         description: Bad request or organization with email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization with this email already exists"
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category not found"
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
 * /organizations:
 *   get:
 *     summary: Get all organizations
 *     tags: [Organizations]
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
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: List of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /organizations/{id}:
 *   put:
 *     summary: Update organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization name
 *               type:
 *                 type: string
 *                 description: Organization type
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Organization email
 *               ownerPhone:
 *                 type: string
 *                 description: Organization owner phone number
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *                 description: Organization owner email
 *               contactPhone:
 *                 type: string
 *                 description: Organization contact phone number
 *               tinNumber:
 *                 type: string
 *                 description: Tax Identification Number

 *               # Note: Location fields (province, district, sector, cell) and document fields (logo, operationalDocument) are now handled in the Profile model
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 description: Organization category ID
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrganizationResponse'
 *       404:
 *         description: Organization or category not found
 *       400:
 *         description: Bad request or email already exists
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /organizations/{id}:
 *   delete:
 *     summary: Delete organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
