'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add coverImage column to SubActions table
      await queryInterface.addColumn(
        'SubActions',
        'coverImage',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Cover image URL for the sub-action'
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
      // Remove coverImage column from SubActions table
      await queryInterface.removeColumn(
        'SubActions',
        'coverImage',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
