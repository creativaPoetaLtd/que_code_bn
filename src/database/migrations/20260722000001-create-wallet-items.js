"use strict";

/**
 * WalletItems ("items wallet") holds non-monetary things a user or organization
 * keeps in their wallet: vouchers, passes, saved actions, custom cards and, when
 * useful, thin references to existing ActionPurchases/QRObjects. It never
 * duplicates monetary balance (Wallets) or the canonical purchase record
 * (ActionPurchases) — it is a generic, extensible container owned by a Wallet.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const exists = tables
      .map((t) => (typeof t === "string" ? t : t.tableName))
      .includes("WalletItems");
    if (exists) return;

    await queryInterface.createTable("WalletItems", {
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
      itemType: {
        type: Sequelize.ENUM(
          "voucher",
          "pass",
          "saved_action",
          "custom_card",
          "transferred_item",
          "action_purchase_ref"
        ),
        allowNull: false,
      },
      // Optional pointer to an existing record (ActionPurchase, QRObject, Action…)
      referenceId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      subtitle: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      imageUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: Sequelize.ENUM("active", "used", "expired", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      isPinned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("WalletItems", ["walletId"]);
    await queryInterface.addIndex("WalletItems", ["walletId", "status"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("WalletItems");
    // Clean up the ENUM types created by Postgres for the ENUM columns.
    await queryInterface.sequelize
      .query('DROP TYPE IF EXISTS "enum_WalletItems_itemType";')
      .catch(() => {});
    await queryInterface.sequelize
      .query('DROP TYPE IF EXISTS "enum_WalletItems_status";')
      .catch(() => {});
  },
};
