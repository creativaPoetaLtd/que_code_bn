"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("DeviceSessions", {
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
        onDelete: "CASCADE",
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      accountType: {
        type: Sequelize.ENUM("user", "organization"),
        allowNull: false,
      },
      refreshTokenHash: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("DeviceSessions", ["userId"], {
      name: "idx_device_sessions_user_id",
    });
    await queryInterface.addIndex("DeviceSessions", ["organizationId"], {
      name: "idx_device_sessions_organization_id",
    });
    await queryInterface.addIndex("DeviceSessions", ["refreshTokenHash"], {
      name: "idx_device_sessions_refresh_token_hash",
    });
    await queryInterface.addIndex("DeviceSessions", ["isActive", "expiresAt"], {
      name: "idx_device_sessions_active_expires",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("DeviceSessions");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_DeviceSessions_accountType";',
    );
  },
};
