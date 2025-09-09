"use strict";

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    await queryInterface.bulkInsert('TransactionCategories', [
      {
        id: uuidv4(),
        name: 'Food',
        description: 'Meals, groceries, and dining out',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Transport',
        description: 'Public transport, fuel, rideshares',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Entertainment',
        description: 'Movies, concerts, games',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Utilities',
        description: 'Electricity, water, internet, phone',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Rent',
        description: 'House or apartment rent',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Healthcare',
        description: 'Medical, dental, and health expenses',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Education',
        description: 'Tuition, books, courses',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Shopping',
        description: 'Clothing, electronics, general shopping',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Travel',
        description: 'Flights, hotels, and travel-related costs',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Other',
        description: 'Miscellaneous expenses',
        isRestricted: false,
        requiresOrgCategoryId: null,
        createdAt: now,
        updatedAt: now
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('TransactionCategories', {
      name: [
        'Food',
        'Transport',
        'Entertainment',
        'Utilities',
        'Rent',
        'Healthcare',
        'Education',
        'Shopping',
        'Travel',
        'Other'
      ]
    }, {});
  }
};
