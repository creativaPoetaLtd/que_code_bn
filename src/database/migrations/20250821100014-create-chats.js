"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Chats", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      isGroup: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

    // Add indexes
    await queryInterface.addIndex("Chats", ["groupId"], {
      name: "idx_chats_group_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Chats");
  },
};
