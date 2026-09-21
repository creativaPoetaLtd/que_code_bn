"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_SharedWalletMembers_status" ADD VALUE IF NOT EXISTS 'pending';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    console.log(
      "Cannot remove enum value from PostgreSQL. Manual intervention required if rollback is needed.",
    );
  },
};
