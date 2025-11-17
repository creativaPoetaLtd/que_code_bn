"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if Users table exists before trying to add columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Users')) {
      await queryInterface.addColumn('Users', 'isOnline', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });

      await queryInterface.addColumn('Users', 'lastSeen', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if Users table exists before trying to remove columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Users')) {
      await queryInterface.removeColumn('Users', 'isOnline');
      await queryInterface.removeColumn('Users', 'lastSeen');
    }
  }
};