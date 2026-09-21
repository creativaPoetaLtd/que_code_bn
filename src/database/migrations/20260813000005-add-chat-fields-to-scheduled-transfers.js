"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ScheduledTransfers", "chatMessageId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "ChatMessages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ScheduledTransfers", "chatMessageId");
  },
};
