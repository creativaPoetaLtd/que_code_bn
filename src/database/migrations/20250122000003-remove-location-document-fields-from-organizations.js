'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove location and document fields from Organizations table
      // These fields are now handled in the Profiles table
      await queryInterface.removeColumn('Organizations', 'province', { transaction });
      await queryInterface.removeColumn('Organizations', 'district', { transaction });
      await queryInterface.removeColumn('Organizations', 'sector', { transaction });
      await queryInterface.removeColumn('Organizations', 'cell', { transaction });
      await queryInterface.removeColumn('Organizations', 'logo', { transaction });
      await queryInterface.removeColumn('Organizations', 'operationalDocument', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add back the location and document fields to Organizations table
      await queryInterface.addColumn('Organizations', 'province', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'district', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'sector', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'cell', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'operationalDocument', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
