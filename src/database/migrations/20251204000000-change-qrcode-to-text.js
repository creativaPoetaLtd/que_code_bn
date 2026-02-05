'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Change qrCode column type from VARCHAR(255) to TEXT
      await queryInterface.changeColumn('Groups', 'qrCode', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
      console.log('Successfully changed qrCode column to TEXT');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, truncate any qrCode values longer than 255 characters
      await queryInterface.sequelize.query(
        `UPDATE "Groups" SET "qrCode" = LEFT("qrCode", 255) WHERE LENGTH("qrCode") > 255`,
        { transaction }
      );

      // Then revert back to VARCHAR(255)
      await queryInterface.changeColumn('Groups', 'qrCode', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
