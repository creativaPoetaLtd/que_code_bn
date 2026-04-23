"use strict";

/**
 * Adds reply support to chat messages.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ChatMessages", "replyToMessageId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "ChatMessages",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ChatMessages", "replyToMessageId");
  },
};
