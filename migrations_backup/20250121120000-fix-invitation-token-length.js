'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change invitationToken column from VARCHAR(255) to TEXT to accommodate longer JWT tokens
    await queryInterface.changeColumn('ContactInvitations', 'invitationToken', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to VARCHAR(255) - Note: This may cause data loss if tokens are longer than 255 chars
    await queryInterface.changeColumn('ContactInvitations', 'invitationToken', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }
};