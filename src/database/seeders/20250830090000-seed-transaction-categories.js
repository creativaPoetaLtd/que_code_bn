"use strict";

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if categories already exist
    const [existingCategories] = await queryInterface.sequelize.query(
      `SELECT name FROM "Categories" WHERE name IN ('Food', 'Transport', 'Entertainment', 'Utilities', 'Rent', 'Healthcare', 'Education', 'Shopping', 'Travel', 'Other')`
    );

    if (existingCategories && existingCategories.length > 0) {
      console.log('✅ Categories already exist, skipping seeding');
      return;
    }

    const now = new Date();
    await queryInterface.bulkInsert('Categories', [
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
        name: 'Transport',
        description: 'Public transport, fuel, rideshares',
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Entertainment',
        description: 'Movies, concerts, games',
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        name: 'Utilities',
        description: 'Electricity, water, internet, phone',
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
        name: 'Shopping',
        description: 'Clothing, electronics, general shopping',
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
    ], {});

    console.log('✅ Successfully seeded transaction categories');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Categories', {
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
