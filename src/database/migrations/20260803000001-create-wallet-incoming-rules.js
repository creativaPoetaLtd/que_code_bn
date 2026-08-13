"use strict";

/**
 * WalletIncomingRules let a wallet owner pre-decide how money *received* from a
 * particular sender is categorized: funds arriving from `senderWalletId` are
 * automatically filed into `categoryId` (growing a WalletRestriction envelope).
 * `cap` optionally limits the lifetime total the rule will restrict, and
 * `restrictedTotal` tracks how much it already has. One rule per (wallet, sender).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const exists = tables
      .map((t) => (typeof t === "string" ? t : t.tableName))
      .includes("WalletIncomingRules");
    if (exists) return;

    await queryInterface.createTable("WalletIncomingRules", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      walletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderWalletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      cap: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      restrictedTotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    });

    await queryInterface.addIndex("WalletIncomingRules", ["walletId"]);
    await queryInterface.addConstraint("WalletIncomingRules", {
      fields: ["walletId", "senderWalletId"],
      type: "unique",
      name: "wallet_incoming_rules_wallet_sender_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("WalletIncomingRules");
  },
};
