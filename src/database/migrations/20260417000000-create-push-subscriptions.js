"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("PushSubscriptions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      endpoint: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      subscription: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastSuccessfulAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastFailureAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastFailureReason: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex("PushSubscriptions", ["userId"], {
      name: "idx_push_subscriptions_user_id",
    });

    await queryInterface.addIndex("PushSubscriptions", ["isActive"], {
      name: "idx_push_subscriptions_is_active",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("PushSubscriptions");
  },
};
