'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add dedicatedQrCodeData column to Actions table
      await queryInterface.addColumn(
        'Actions',
        'dedicatedQrCodeData',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Base64 QR code data URL for the action'
        },
        { transaction }
      );

      // Add dedicatedQrCodeData column to SubActions table
      await queryInterface.addColumn(
        'SubActions',
        'dedicatedQrCodeData',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Base64 QR code data URL for the sub-action'
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Remove dedicatedQrCodeData column from Actions table
      await queryInterface.removeColumn(
        'Actions',
        'dedicatedQrCodeData',
        { transaction }
      );

      // Remove dedicatedQrCodeData column from SubActions table
      await queryInterface.removeColumn(
        'SubActions',
        'dedicatedQrCodeData',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
