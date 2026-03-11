"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("AuditLogs", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment:
          "User who performed the action (null for unauthenticated requests)",
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "Organization context if applicable",
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
        comment:
          "Type of action performed (e.g., 'CREATE_USER', 'UPDATE_TRANSACTION', 'LOGIN')",
      },
      method: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "HTTP method (GET, POST, PUT, DELETE, etc.)",
      },
      endpoint: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "API endpoint that was called",
      },
      statusCode: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "HTTP response status code",
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "IP address of the requester",
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "User agent string from the request",
      },
      requestBody: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Request payload (sensitive data filtered)",
      },
      responseBody: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Response data (limited to errors or success messages)",
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Additional contextual information",
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Request duration in milliseconds",
      },
      level: {
        type: Sequelize.ENUM("info", "warning", "error", "critical"),
        defaultValue: "info",
        allowNull: false,
        comment: "Severity level of the log entry",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex("AuditLogs", ["userId"]);
    await queryInterface.addIndex("AuditLogs", ["organizationId"]);
    await queryInterface.addIndex("AuditLogs", ["action"]);
    await queryInterface.addIndex("AuditLogs", ["method"]);
    await queryInterface.addIndex("AuditLogs", ["statusCode"]);
    await queryInterface.addIndex("AuditLogs", ["level"]);
    await queryInterface.addIndex("AuditLogs", ["createdAt"]);
    await queryInterface.addIndex("AuditLogs", ["endpoint"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("AuditLogs");
  },
};
