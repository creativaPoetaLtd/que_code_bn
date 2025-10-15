'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop the existing foreign key constraints that point to TransactionCategories
      await queryInterface.removeConstraint('Transactions', 'Transactions_categoryId_fkey', { transaction });
      await queryInterface.removeConstraint('Transactions', 'Transactions_constraintCategoryId_fkey', { transaction });
      
      // Add new foreign key constraints that point to Categories table
      await queryInterface.addConstraint('Transactions', {
        fields: ['categoryId'],
        type: 'foreign key',
        name: 'Transactions_categoryId_fkey',
        references: {
          table: 'Categories',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });
      
      await queryInterface.addConstraint('Transactions', {
        fields: ['constraintCategoryId'],
        type: 'foreign key',
        name: 'Transactions_constraintCategoryId_fkey',
        references: {
          table: 'Categories',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop the new foreign key constraints
      await queryInterface.removeConstraint('Transactions', 'Transactions_categoryId_fkey', { transaction });
      await queryInterface.removeConstraint('Transactions', 'Transactions_constraintCategoryId_fkey', { transaction });
      
      // Restore the old foreign key constraints pointing to TransactionCategories
      await queryInterface.addConstraint('Transactions', {
        fields: ['categoryId'],
        type: 'foreign key',
        name: 'Transactions_categoryId_fkey',
        references: {
          table: 'TransactionCategories',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });
      
      await queryInterface.addConstraint('Transactions', {
        fields: ['constraintCategoryId'],
        type: 'foreign key',
        name: 'Transactions_constraintCategoryId_fkey',
        references: {
          table: 'TransactionCategories',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
