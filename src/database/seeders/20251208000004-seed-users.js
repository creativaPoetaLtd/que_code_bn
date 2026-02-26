"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash("Password123!", 10);

    const users = [
      {
        id: "91111111-1111-1111-1111-111111111111",
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@quecode.com",
        phone: "+250788000001",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "92222222-2222-2222-2222-222222222222",
        firstName: "Admin",
        lastName: "User",
        email: "admin@quecode.com",
        phone: "+250788000002",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "93333333-3333-3333-3333-333333333333",
        firstName: "Organization",
        lastName: "Admin",
        email: "orgadmin@quecode.com",
        phone: "+250788000003",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "94444444-4444-4444-4444-444444444444",
        firstName: "Moderator",
        lastName: "User",
        email: "moderator@quecode.com",
        phone: "+250788000004",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "95555555-5555-5555-5555-555555555555",
        firstName: "Regular",
        lastName: "User",
        email: "user@quecode.com",
        phone: "+250788000005",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "96666666-6666-6666-6666-666666666666",
        firstName: "Test",
        lastName: "User1",
        email: "testuser1@quecode.com",
        phone: "+250788000006",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "97777777-7777-7777-7777-777777777777",
        firstName: "Test",
        lastName: "User2",
        email: "testuser2@quecode.com",
        phone: "+250788000007",
        password: hashedPassword,
        isVerified: true,
        approvalStatus: true,
        hasPinSet: true,
        transactionPin: await bcrypt.hash("1234", 10),
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "98888888-8888-8888-8888-888888888888",
        firstName: "Pending",
        lastName: "User",
        email: "pending@quecode.com",
        phone: "+250788000008",
        password: hashedPassword,
        isVerified: false,
        approvalStatus: false,
        hasPinSet: false,
        pinAttempts: 0,
        isOnline: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Use INSERT ... ON CONFLICT for PostgreSQL upsert
    for (const user of users) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Users" ("id", "firstName", "lastName", "email", "phone", "password", "isVerified", "approvalStatus", "hasPinSet", "transactionPin", "pinAttempts", "isOnline", "createdAt", "updatedAt")
         VALUES (:id, :firstName, :lastName, :email, :phone, :password, :isVerified, :approvalStatus, :hasPinSet, :transactionPin, :pinAttempts, :isOnline, :createdAt, :updatedAt)
         ON CONFLICT ("id") 
         DO UPDATE SET 
           "firstName" = EXCLUDED."firstName",
           "lastName" = EXCLUDED."lastName",
           "password" = EXCLUDED."password",
           "isVerified" = EXCLUDED."isVerified",
           "approvalStatus" = EXCLUDED."approvalStatus",
           "updatedAt" = EXCLUDED."updatedAt"`,
        {
          replacements: user,
          type: queryInterface.sequelize.QueryTypes.INSERT,
        }
      ).catch((error) => {
        console.log(`User ${user.email} already exists, skipping...`);
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Users", null, {});
  },
};
