"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roles = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "super_admin",
        description: "Super Administrator with full system access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "admin",
        description: "Administrator with elevated privileges",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "organization_admin",
        description: "Organization Administrator",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "44444444-4444-4444-4444-444444444444",
        name: "moderator",
        description: "Content and User Moderator",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "55555555-5555-5555-5555-555555555555",
        name: "user",
        description: "Regular User",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await queryInterface.bulkInsert("Roles", roles, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Roles", null, {});
  },
};
