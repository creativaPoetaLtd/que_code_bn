"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Alter the invitationToken column to support longer text (TEXT type)
    await queryInterface.changeColumn("ContactInvitations", "invitationToken", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to VARCHAR(255) - WARNING: this may truncate data
    await queryInterface.changeColumn("ContactInvitations", "invitationToken", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};