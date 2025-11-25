"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if constraint already exists
    const constraints = await queryInterface.sequelize.query(
      `SELECT constraint_name FROM information_schema.table_constraints 
       WHERE table_name = 'ChatMessages' AND constraint_name = 'ChatMessages_transactionId_fkey'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (constraints.length === 0) {
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
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if constraint exists before removing
    const constraints = await queryInterface.sequelize.query(
      `SELECT constraint_name FROM information_schema.table_constraints 
       WHERE table_name = 'ChatMessages' AND constraint_name = 'ChatMessages_transactionId_fkey'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (constraints.length > 0) {
      // Remove foreign key constraint
      await queryInterface.removeConstraint("ChatMessages", "ChatMessages_transactionId_fkey");
    }
  },
};