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
    // Check if there are any tokens longer than 255 characters
    const [results] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count 
      FROM "ContactInvitations" 
      WHERE LENGTH("invitationToken") > 255
    `);
    
    if (results[0].count > 0) {
      console.log(`Warning: Found ${results[0].count} tokens longer than 255 characters.`);
      console.log('Truncating long tokens before reverting column type...');
      
      // Truncate tokens that are too long
      await queryInterface.sequelize.query(`
        UPDATE "ContactInvitations" 
        SET "invitationToken" = LEFT("invitationToken", 255) 
        WHERE LENGTH("invitationToken") > 255
      `);
    }
    
    // Now safely revert back to VARCHAR(255)
    await queryInterface.changeColumn("ContactInvitations", "invitationToken", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};