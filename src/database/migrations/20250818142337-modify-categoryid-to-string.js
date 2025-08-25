'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // First, remove the foreign key constraint if it exists
    try {
      await queryInterface.removeConstraint('transactions', 'transactions_categoryId_fkey');
    } catch (error) {
      console.log('Foreign key constraint may not exist, continuing...');
    }

    // Change the categoryId column from UUID to VARCHAR(50)
    await queryInterface.changeColumn('transactions', 'categoryId', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert the categoryId column back to UUID
    await queryInterface.changeColumn('transactions', 'categoryId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  }
};
