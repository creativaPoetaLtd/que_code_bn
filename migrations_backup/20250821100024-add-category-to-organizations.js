"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Skip - categoryId is now part of the main Organizations table creation
  },

  down: async (queryInterface, Sequelize) => {
    // Skip - categoryId removal handled in main table drop
  },
};
