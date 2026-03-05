"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'suspended' to the status enum for Actions table
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Actions_status" ADD VALUE IF NOT EXISTS 'suspended';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove a value
    // For safety, we won't implement the down migration
    console.log(
      "Cannot remove enum value from PostgreSQL. Manual intervention required if rollback is needed.",
    );
  },
};
