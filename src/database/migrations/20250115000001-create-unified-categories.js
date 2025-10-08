"use strict";

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Step 1: Create new Categories table
      await queryInterface.createTable("Categories", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // Step 2: Seed with common categories
      const now = new Date();
      await queryInterface.bulkInsert('Categories', [
        {
          id: uuidv4(),
          name: 'School',
          description: 'Educational institutions and school-related expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Hospital',
          description: 'Medical facilities and healthcare expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Restaurant',
          description: 'Food service establishments and dining expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Transport',
          description: 'Transportation services and travel expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Entertainment',
          description: 'Entertainment venues and recreational expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Shopping',
          description: 'Retail stores and shopping expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Utilities',
          description: 'Utility companies and service expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Food',
          description: 'Meals, groceries, and dining out',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Rent',
          description: 'House or apartment rent',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Healthcare',
          description: 'Medical, dental, and health expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Education',
          description: 'Tuition, books, courses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Travel',
          description: 'Flights, hotels, and travel-related costs',
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: uuidv4(),
          name: 'Other',
          description: 'Miscellaneous expenses',
          isActive: true,
          createdAt: now,
          updatedAt: now
        }
      ], { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.dropTable("Categories", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
