"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add foreign key constraint from ChatMessages to Transactions
    await queryInterface.addConstraint("ChatMessages", {
      fields: ["transactionId"],
      type: "foreign key",
      name: "ChatMessages_transactionId_fkey",
      references: {
        table: "Transactions",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint
    await queryInterface.removeConstraint("ChatMessages", "ChatMessages_transactionId_fkey");
  },
};