"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Check if dedicatedQrCodeData column exists in Actions table
      const actionsTable = await queryInterface.describeTable("Actions");
      if (!actionsTable.dedicatedQrCodeData) {
        await queryInterface.addColumn(
          "Actions",
          "dedicatedQrCodeData",
          {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Base64 QR code data URL for the action",
          },
          { transaction },
        );
      }

      // Check if dedicatedQrCodeData column exists in SubActions table
      const subActionsTable = await queryInterface.describeTable("SubActions");
      if (!subActionsTable.dedicatedQrCodeData) {
        await queryInterface.addColumn(
          "SubActions",
          "dedicatedQrCodeData",
          {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Base64 QR code data URL for the sub-action",
          },
          { transaction },
        );
      }

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
      await queryInterface.removeColumn("Actions", "dedicatedQrCodeData", {
        transaction,
      });

      // Remove dedicatedQrCodeData column from SubActions table
      await queryInterface.removeColumn("SubActions", "dedicatedQrCodeData", {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
