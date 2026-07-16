"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const subActionsTable = await queryInterface.describeTable("SubActions");
      if (!subActionsTable.images) {
        await queryInterface.addColumn(
          "SubActions",
          "images",
          {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: [],
            comment: "Gallery image URLs shown in a carousel for the sub-action",
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

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn("SubActions", "images", {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
