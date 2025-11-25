"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Check if Users table exists before trying to add columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Users')) {
      if (!(await columnExists('Users', 'isOnline'))) {
        await queryInterface.addColumn('Users', 'isOnline', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        });
      }

      if (!(await columnExists('Users', 'lastSeen'))) {
        await queryInterface.addColumn('Users', 'lastSeen', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Check if Users table exists before trying to remove columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Users')) {
      if (await columnExists('Users', 'isOnline')) {
        await queryInterface.removeColumn('Users', 'isOnline');
      }
      if (await columnExists('Users', 'lastSeen')) {
        await queryInterface.removeColumn('Users', 'lastSeen');
      }
    }
  }
};