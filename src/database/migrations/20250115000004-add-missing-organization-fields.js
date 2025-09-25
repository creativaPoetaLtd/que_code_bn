"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add missing organization fields
      await queryInterface.addColumn('Organizations', 'contactPhone', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'tinNumber', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await transaction.commit();
      console.log("✅ Added missing organization fields: contactPhone, tinNumber");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.removeColumn('Organizations', 'contactPhone', { transaction });
      await queryInterface.removeColumn('Organizations', 'tinNumber', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
