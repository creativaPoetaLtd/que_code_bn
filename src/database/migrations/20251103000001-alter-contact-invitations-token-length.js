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
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, truncate any invitationToken values longer than 255 characters
      await queryInterface.sequelize.query(
        `UPDATE "ContactInvitations" SET "invitationToken" = LEFT("invitationToken", 255) WHERE LENGTH("invitationToken") > 255`,
        { transaction }
      );

      // Revert back to VARCHAR(255)
      await queryInterface.changeColumn("ContactInvitations", "invitationToken", {
        type: Sequelize.STRING,
        allowNull: false,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};