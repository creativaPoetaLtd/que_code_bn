import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "QueCode Payment API",
      version: "1.0.0",
      description:
        "A comprehensive payment platform API for users and organizations",
      contact: {
        name: "QueCode Team",
        email: "support@quecode.com",
      },
    },
    servers: [
      {
        url: process.env.BASE_URL || "http://localhost:3011/api/v1",
        description: "Development Server",
      },
      {
        url: "https://api.quecode.com",
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            isVerified: { type: "boolean" },
            approvalStatus: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UserRegistration: {
          type: "object",
          required: ["firstName", "lastName", "email", "phone", "password"],
          properties: {
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            email: {
              type: "string",
              format: "email",
              example: "john.doe@example.com",
            },
            phone: { type: "string", example: "+1234567890" },
            password: { type: "string", minLength: 6, example: "password123" },
          },
        },
        Organization: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            ownerName: { type: "string" },
            ownerEmail: { type: "string", format: "email" },
            ownerPhone: { type: "string" },
            approvalStatus: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        OrganizationRegistration: {
          type: "object",
          required: [
            "name",
            "email",
            "ownerName",
            "ownerEmail",
            "ownerPhone",
            "password",
          ],
          properties: {
            name: { type: "string", example: "Acme Corporation" },
            email: {
              type: "string",
              format: "email",
              example: "info@acme.com",
            },
            ownerName: { type: "string", example: "Jane Smith" },
            ownerEmail: {
              type: "string",
              format: "email",
              example: "jane.smith@acme.com",
            },
            ownerPhone: { type: "string", example: "+1234567890" },
            password: { type: "string", minLength: 6, example: "password123" },
          },
        },
        Profile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["individual", "organization"] },
            userId: { type: "string", format: "uuid", nullable: true },
            organizationId: { type: "string", format: "uuid", nullable: true },
            qrCode: { type: "string", description: "Base64 QR Code data URL" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Wallet: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid", nullable: true },
            organizationId: { type: "string", format: "uuid", nullable: true },
            balance: { type: "number", format: "decimal", default: 0 },
            currency: { type: "string", default: "RWF" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object", nullable: true },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string", nullable: true },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/swagger/auth.swagger.ts",
    "./src/swagger/users.swagger.ts",
    "./src/swagger/organizations.swagger.ts",
    "./src/swagger/organizationCategories.swagger.ts",
    "./src/swagger/notifications.swagger.ts",
    "./src/swagger/contacts.swagger.ts",
    "./src/swagger/groups.swagger.ts",
    "./src/swagger/chat.swagger.ts",
  ],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

export const setupSwagger = (app: Application): void => {
  // Swagger page
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "QueCode API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
    })
  );

  // Docs in JSON format
  app.get("/swagger.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("📚 Swagger documentation available at /api-docs");
};

export default swaggerSpec;
