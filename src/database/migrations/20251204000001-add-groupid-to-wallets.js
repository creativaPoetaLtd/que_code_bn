'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if Wallets table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('Wallets')) {
        console.log('Wallets table does not exist, skipping migration');
        await transaction.commit();
        return;
      }

      // Check if groupId column already exists
      const table = await queryInterface.describeTable('Wallets');
      if (table.groupId) {
        console.log('groupId column already exists in Wallets table');
        await transaction.commit();
        return;
      }

      // Add groupId column to Wallets table
      await queryInterface.addColumn('Wallets', 'groupId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Groups',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      // Add index for better query performance
      await queryInterface.addIndex('Wallets', ['groupId'], {
        name: 'wallets_groupid_idx',
        transaction
      });

      await transaction.commit();
      console.log('Successfully added groupId column to Wallets table');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if Wallets table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('Wallets')) {
        console.log('Wallets table does not exist, skipping rollback');
        await transaction.commit();
        return;
      }

      // Remove index
      await queryInterface.removeIndex('Wallets', 'wallets_groupid_idx', { transaction });

      // Remove groupId column
      await queryInterface.removeColumn('Wallets', 'groupId', { transaction });

      await transaction.commit();
      console.log('Successfully removed groupId column from Wallets table');
    } catch (error) {
      await transaction.rollback();
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};
