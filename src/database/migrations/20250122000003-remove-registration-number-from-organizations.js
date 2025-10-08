"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove registrationNumber column from Organizations table
      await queryInterface.removeColumn("Organizations", "registrationNumber", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add back registrationNumber column
      await queryInterface.addColumn("Organizations", "registrationNumber", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
