'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Add PIN-related fields to Users table
    if (!(await columnExists('Users', 'transactionPin'))) {
      await queryInterface.addColumn('Users', 'transactionPin', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Hashed 4-digit PIN for transaction verification'
      });
    }

    if (!(await columnExists('Users', 'hasPinSet'))) {
      await queryInterface.addColumn('Users', 'hasPinSet', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether user has set up their transaction PIN'
      });
    }

    if (!(await columnExists('Users', 'pinAttempts'))) {
      await queryInterface.addColumn('Users', 'pinAttempts', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of failed PIN verification attempts'
      });
    }

    if (!(await columnExists('Users', 'pinLockedUntil'))) {
      await queryInterface.addColumn('Users', 'pinLockedUntil', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp until PIN is locked due to too many failed attempts'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Remove PIN-related fields from Users table
    if (await columnExists('Users', 'transactionPin')) {
      await queryInterface.removeColumn('Users', 'transactionPin');
    }
    if (await columnExists('Users', 'hasPinSet')) {
      await queryInterface.removeColumn('Users', 'hasPinSet');
    }
    if (await columnExists('Users', 'pinAttempts')) {
      await queryInterface.removeColumn('Users', 'pinAttempts');
    }
    if (await columnExists('Users', 'pinLockedUntil')) {
      await queryInterface.removeColumn('Users', 'pinLockedUntil');
    }
  }
};
