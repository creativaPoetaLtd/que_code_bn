'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Helper to check if constraint exists
      const constraintExists = async (constraintName) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT constraint_name FROM information_schema.table_constraints 
           WHERE table_name = 'Transactions' AND constraint_name = '${constraintName}'`,
          { transaction }
        );
        return results.length > 0;
      };

      // Drop the existing foreign key constraints that point to TransactionCategories
      if (await constraintExists('Transactions_categoryId_fkey')) {
        await queryInterface.removeConstraint('Transactions', 'Transactions_categoryId_fkey', { transaction });
      }
      if (await constraintExists('Transactions_constraintCategoryId_fkey')) {
        await queryInterface.removeConstraint('Transactions', 'Transactions_constraintCategoryId_fkey', { transaction });
      }
      
      // Add new foreign key constraints that point to Categories table
      if (!(await constraintExists('Transactions_categoryId_fkey'))) {
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
      }
      
      if (!(await constraintExists('Transactions_constraintCategoryId_fkey'))) {
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
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Helper to check if constraint exists
      const constraintExists = async (constraintName) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT constraint_name FROM information_schema.table_constraints 
           WHERE table_name = 'Transactions' AND constraint_name = '${constraintName}'`,
          { transaction }
        );
        return results.length > 0;
      };

      // Drop the new foreign key constraints
      if (await constraintExists('Transactions_categoryId_fkey')) {
        await queryInterface.removeConstraint('Transactions', 'Transactions_categoryId_fkey', { transaction });
      }
      if (await constraintExists('Transactions_constraintCategoryId_fkey')) {
        await queryInterface.removeConstraint('Transactions', 'Transactions_constraintCategoryId_fkey', { transaction });
      }
      
      // Restore the old foreign key constraints pointing to TransactionCategories
      if (!(await constraintExists('Transactions_categoryId_fkey'))) {
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
      }
      
      if (!(await constraintExists('Transactions_constraintCategoryId_fkey'))) {
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
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
