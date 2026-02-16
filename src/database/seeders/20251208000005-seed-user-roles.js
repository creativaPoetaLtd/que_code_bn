"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const userRoles = [
      {
        id: "81111111-1111-1111-1111-111111111111",
        userId: "91111111-1111-1111-1111-111111111111",
        roleId: "11111111-1111-1111-1111-111111111111", // Super Admin
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "82222222-2222-2222-2222-222222222222",
        userId: "92222222-2222-2222-2222-222222222222",
        roleId: "22222222-2222-2222-2222-222222222222", // Admin
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "83333333-3333-3333-3333-333333333333",
        userId: "93333333-3333-3333-3333-333333333333",
        roleId: "33333333-3333-3333-3333-333333333333", // Organization Admin
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "84444444-4444-4444-4444-444444444444",
        userId: "94444444-4444-4444-4444-444444444444",
        roleId: "44444444-4444-4444-4444-444444444444", // Moderator
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "85555555-5555-5555-5555-555555555555",
        userId: "95555555-5555-5555-5555-555555555555",
        roleId: "55555555-5555-5555-5555-555555555555", // User
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "86666666-6666-6666-6666-666666666666",
        userId: "96666666-6666-6666-6666-666666666666",
        roleId: "55555555-5555-5555-5555-555555555555", // User
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "87777777-7777-7777-7777-777777777777",
        userId: "97777777-7777-7777-7777-777777777777",
        roleId: "55555555-5555-5555-5555-555555555555", // User
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "88888888-8888-8888-8888-888888888888",
        userId: "98888888-8888-8888-8888-888888888888",
        roleId: "55555555-5555-5555-5555-555555555555", // User (pending)
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Use upsert to handle existing records gracefully
    for (const userRole of userRoles) {
      await queryInterface
        .bulkInsert("UserRoles", [userRole], {
          updateOnDuplicate: ["userId", "roleId", "updatedAt"],
        })
        .catch(async () => {
          // If bulk insert fails, skip (record already exists)
          console.log(`UserRole ${userRole.id} already exists, skipping...`);
        });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("UserRoles", null, {});
  },
};
