"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("OutsideMessages")) {
      return;
    }

    await queryInterface.createTable("OutsideMessages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      receiverId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      senderName: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      senderContact: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING(40),
        allowNull: true,
        defaultValue: "welcome_page",
      },
      meta: {
        type: Sequelize.JSONB,
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

    await queryInterface.addIndex("OutsideMessages", ["receiverId"], {
      name: "idx_outside_messages_receiver_id",
    });
    await queryInterface.addIndex("OutsideMessages", ["status"], {
      name: "idx_outside_messages_status",
    });
    await queryInterface.addIndex("OutsideMessages", ["createdAt"], {
      name: "idx_outside_messages_created_at",
    });
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("OutsideMessages")) {
      return;
    }

    await queryInterface.dropTable("OutsideMessages");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_OutsideMessages_status";');
  },
};
