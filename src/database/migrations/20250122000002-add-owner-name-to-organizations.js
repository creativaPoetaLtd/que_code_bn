'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add ownerName field back to Organizations table
      await queryInterface.addColumn('Organizations', 'ownerName', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Unknown Owner'
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
      // Remove ownerName field
      await queryInterface.removeColumn('Organizations', 'ownerName', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
