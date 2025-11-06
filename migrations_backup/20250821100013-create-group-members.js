"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // This migration is handled by 20250821100012-create-groups.js
    // GroupMembers table is created as part of the Groups migration
    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    // This rollback is handled by 20250821100012-create-groups.js
    return Promise.resolve();
  },
};