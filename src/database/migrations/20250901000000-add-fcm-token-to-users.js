'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('Users', 'fcmToken', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (e) {
      // Column already exists, ignore
      console.log('Column fcmToken already exists or migration failed: ', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'fcmToken');
  }
};