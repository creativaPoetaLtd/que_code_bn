"use strict";
const { v4: uuidv4 } = require("uuid");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Super Admin - All permissions
    const superAdminPermissions = [
      "01111111-1111-1111-1111-111111111111",
      "01111111-1111-1111-1111-111111111112",
      "01111111-1111-1111-1111-111111111113",
      "01111111-1111-1111-1111-111111111114",
      "01111111-1111-1111-1111-111111111115",
      "02222222-2222-2222-2222-222222222221",
      "02222222-2222-2222-2222-222222222222",
      "02222222-2222-2222-2222-222222222223",
      "02222222-2222-2222-2222-222222222224",
      "02222222-2222-2222-2222-222222222225",
      "03333333-3333-3333-3333-333333333331",
      "03333333-3333-3333-3333-333333333332",
      "03333333-3333-3333-3333-333333333333",
      "03333333-3333-3333-3333-333333333334",
      "03333333-3333-3333-3333-333333333335",
      "04444444-4444-4444-4444-444444444441",
      "04444444-4444-4444-4444-444444444443",
      "04444444-4444-4444-4444-444444444444",
      "04444444-4444-4444-4444-444444444445",
      "05555555-5555-5555-5555-555555555551",
      "05555555-5555-5555-5555-555555555552",
      "05555555-5555-5555-5555-555555555553",
      "06666666-6666-6666-6666-666666666661",
      "06666666-6666-6666-6666-666666666662",
      "06666666-6666-6666-6666-666666666663",
      "07777777-7777-7777-7777-777777777771",
      "07777777-7777-7777-7777-777777777772",
    ];

    // Admin - Most permissions except role/permission management
    const adminPermissions = [
      "01111111-1111-1111-1111-111111111111",
      "01111111-1111-1111-1111-111111111113",
      "01111111-1111-1111-1111-111111111115",
      "02222222-2222-2222-2222-222222222221",
      "02222222-2222-2222-2222-222222222225",
      "03333333-3333-3333-3333-333333333331",
      "03333333-3333-3333-3333-333333333333",
      "03333333-3333-3333-3333-333333333335",
      "04444444-4444-4444-4444-444444444441",
      "04444444-4444-4444-4444-444444444444",
      "05555555-5555-5555-5555-555555555551",
      "05555555-5555-5555-5555-555555555552",
      "05555555-5555-5555-5555-555555555553",
      "06666666-6666-6666-6666-666666666662",
      "07777777-7777-7777-7777-777777777771",
      "07777777-7777-7777-7777-777777777772",
    ];

    // Organization Admin - Organization and transaction management
    const orgAdminPermissions = [
      "03333333-3333-3333-3333-333333333331",
      "03333333-3333-3333-3333-333333333333",
      "04444444-4444-4444-4444-444444444441",
      "04444444-4444-4444-4444-444444444442",
      "04444444-4444-4444-4444-444444444443",
      "05555555-5555-5555-5555-555555555551",
      "05555555-5555-5555-5555-555555555552",
      "07777777-7777-7777-7777-777777777772",
    ];

    // Moderator - Content moderation and user viewing
    const moderatorPermissions = [
      "01111111-1111-1111-1111-111111111111",
      "07777777-7777-7777-7777-777777777771",
      "07777777-7777-7777-7777-777777777772",
    ];

    // User - Basic permissions
    const userPermissions = [
      "04444444-4444-4444-4444-444444444442",
      "04444444-4444-4444-4444-444444444443",
    ];

    const rolePermissions = [];

    // Super Admin
    superAdminPermissions.forEach((permId) => {
      rolePermissions.push({
        id: uuidv4(),
        roleId: "11111111-1111-1111-1111-111111111111",
        permissionId: permId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Admin
    adminPermissions.forEach((permId) => {
      rolePermissions.push({
        id: uuidv4(),
        roleId: "22222222-2222-2222-2222-222222222222",
        permissionId: permId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Organization Admin
    orgAdminPermissions.forEach((permId) => {
      rolePermissions.push({
        id: uuidv4(),
        roleId: "33333333-3333-3333-3333-333333333333",
        permissionId: permId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Moderator
    moderatorPermissions.forEach((permId) => {
      rolePermissions.push({
        id: uuidv4(),
        roleId: "44444444-4444-4444-4444-444444444444",
        permissionId: permId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // User
    userPermissions.forEach((permId) => {
      rolePermissions.push({
        id: uuidv4(),
        roleId: "55555555-5555-5555-5555-555555555555",
        permissionId: permId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await queryInterface.bulkInsert("RolePermissions", rolePermissions, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("RolePermissions", null, {});
  },
};
