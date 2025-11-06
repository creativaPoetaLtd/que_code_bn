'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add PIN-related fields to Users table
    await queryInterface.addColumn('Users', 'transactionPin', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Hashed 4-digit PIN for transaction verification'
    });

    await queryInterface.addColumn('Users', 'hasPinSet', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether user has set up their transaction PIN'
    });

    await queryInterface.addColumn('Users', 'pinAttempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of failed PIN verification attempts'
    });

    await queryInterface.addColumn('Users', 'pinLockedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp until PIN is locked due to too many failed attempts'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove PIN-related fields from Users table
    await queryInterface.removeColumn('Users', 'transactionPin');
    await queryInterface.removeColumn('Users', 'hasPinSet');
    await queryInterface.removeColumn('Users', 'pinAttempts');
    await queryInterface.removeColumn('Users', 'pinLockedUntil');
  }
};
