"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("WalletRestrictions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      walletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "TransactionCategories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
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

    // Add indexes
    await queryInterface.addIndex("WalletRestrictions", ["walletId"], {
      name: "idx_wallet_restrictions_wallet_id",
    });
    await queryInterface.addIndex("WalletRestrictions", ["categoryId"], {
      name: "idx_wallet_restrictions_category_id",
    });
    await queryInterface.addIndex(
      "WalletRestrictions",
      ["walletId", "categoryId"],
      {
        name: "idx_wallet_restrictions_wallet_category",
        unique: true,
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("WalletRestrictions");
  },
};
