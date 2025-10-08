'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add new required fields
      await queryInterface.addColumn('Organizations', 'type', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'organization'
      }, { transaction });

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

      await queryInterface.addColumn('Organizations', 'registrationNumber', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

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

      // Add optional fields
      await queryInterface.addColumn('Organizations', 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'operationalDocument', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      // Remove old fields that are no longer needed
      await queryInterface.removeColumn('Organizations', 'ownerName', { transaction });
      await queryInterface.removeColumn('Organizations', 'description', { transaction });
      await queryInterface.removeColumn('Organizations', 'address', { transaction });
      await queryInterface.removeColumn('Organizations', 'services', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove new fields
      await queryInterface.removeColumn('Organizations', 'type', { transaction });
      await queryInterface.removeColumn('Organizations', 'contactPhone', { transaction });
      await queryInterface.removeColumn('Organizations', 'tinNumber', { transaction });
      await queryInterface.removeColumn('Organizations', 'registrationNumber', { transaction });
      await queryInterface.removeColumn('Organizations', 'province', { transaction });
      await queryInterface.removeColumn('Organizations', 'district', { transaction });
      await queryInterface.removeColumn('Organizations', 'sector', { transaction });
      await queryInterface.removeColumn('Organizations', 'cell', { transaction });
      await queryInterface.removeColumn('Organizations', 'logo', { transaction });
      await queryInterface.removeColumn('Organizations', 'operationalDocument', { transaction });

      // Add back old fields
      await queryInterface.addColumn('Organizations', 'ownerName', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'address', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'services', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
