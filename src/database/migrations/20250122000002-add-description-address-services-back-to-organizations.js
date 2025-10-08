"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add description column back
      await queryInterface.addColumn("Organizations", "description", {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      // Add address column back
      await queryInterface.addColumn("Organizations", "address", {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      // Add services column back (JSON array)
      await queryInterface.addColumn("Organizations", "services", {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove the added columns
      await queryInterface.removeColumn("Organizations", "description", { transaction });
      await queryInterface.removeColumn("Organizations", "address", { transaction });
      await queryInterface.removeColumn("Organizations", "services", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
