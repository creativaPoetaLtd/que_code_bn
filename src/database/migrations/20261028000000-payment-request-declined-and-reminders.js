"use strict";

/**
 * Payment requests: a separate "declined" status (until now a decline was stored as
 * "cancelled", so the requester couldn't tell the two apart), a lastRemindedAt timestamp for
 * the once-a-day Remind action, and indexes for the per-tab list queries.
 * Every step checks first, so this is safe on databases where sync() created the table.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("PaymentRequests")) return;

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_PaymentRequests_status" ADD VALUE IF NOT EXISTS 'declined';
    `);

    const columns = await queryInterface.describeTable("PaymentRequests");
    if (!columns.lastRemindedAt) {
      await queryInterface.addColumn("PaymentRequests", "lastRemindedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex("PaymentRequests");
    const has = (name) => indexes.some((index) => index.name === name);
    if (!has("payment_requests_recipient_status_idx")) {
      await queryInterface.addIndex("PaymentRequests", ["recipientId", "status", "createdAt"], {
        name: "payment_requests_recipient_status_idx",
      });
    }
    if (!has("payment_requests_sender_status_idx")) {
      await queryInterface.addIndex("PaymentRequests", ["senderId", "status", "createdAt"], {
        name: "payment_requests_sender_status_idx",
      });
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("PaymentRequests")) return;
    await queryInterface.removeIndex("PaymentRequests", "payment_requests_sender_status_idx").catch(() => {});
    await queryInterface.removeIndex("PaymentRequests", "payment_requests_recipient_status_idx").catch(() => {});
    const columns = await queryInterface.describeTable("PaymentRequests");
    if (columns.lastRemindedAt) await queryInterface.removeColumn("PaymentRequests", "lastRemindedAt");
    // PostgreSQL can't drop an enum value; "declined" stays but is unused after a rollback.
    console.log("Leaving the 'declined' value on enum_PaymentRequests_status.");
  },
};
