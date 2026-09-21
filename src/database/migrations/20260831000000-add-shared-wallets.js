"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const tables = await queryInterface.showAllTables({ transaction });

      if (!tables.includes("SharedWallets")) {
        await queryInterface.createTable(
          "SharedWallets",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true,
            },
            name: { type: Sequelize.STRING, allowNull: false },
            withdrawalPolicy: {
              type: Sequelize.ENUM("free", "approval"),
              allowNull: false,
              defaultValue: "approval",
            },
            createdByUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            groupId: {
              type: Sequelize.UUID,
              allowNull: true,
              unique: true,
              references: { model: "Groups", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );
      }

      if (!tables.includes("SharedWalletMembers")) {
        await queryInterface.createTable(
          "SharedWalletMembers",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true,
            },
            sharedWalletId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "SharedWallets", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            userId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            role: {
              type: Sequelize.ENUM("owner", "admin", "member"),
              allowNull: false,
              defaultValue: "member",
            },
            status: {
              type: Sequelize.ENUM("active", "left", "removed"),
              allowNull: false,
              defaultValue: "active",
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("SharedWalletMembers", ["sharedWalletId", "userId"], {
          unique: true,
          name: "shared_wallet_members_wallet_user_unique",
          transaction,
        });
      }

      const groupsColumns = await queryInterface.describeTable("Groups", { transaction });

      if (!groupsColumns.sharedWalletId) {
        await queryInterface.addColumn(
          "Groups",
          "sharedWalletId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            unique: true,
            references: { model: "SharedWallets", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      if (groupsColumns.hasSharedWallet) {
        await queryInterface.removeColumn("Groups", "hasSharedWallet", { transaction });
      }

      if (groupsColumns.withdrawalPolicy) {
        await queryInterface.removeColumn("Groups", "withdrawalPolicy", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_Groups_withdrawalPolicy"',
          { transaction }
        );
      }

      const walletsColumns = await queryInterface.describeTable("Wallets", { transaction });

      if (!walletsColumns.sharedWalletId) {
        await queryInterface.addColumn(
          "Wallets",
          "sharedWalletId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            unique: true,
            references: { model: "SharedWallets", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          { transaction }
        );
      }

      if (!tables.includes("SharedWalletWithdrawals")) {
        await queryInterface.createTable(
          "SharedWalletWithdrawals",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true,
            },
            sharedWalletId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "SharedWallets", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            walletId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Wallets", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            requestedByUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            currency: { type: Sequelize.STRING, allowNull: false, defaultValue: "RWF" },
            note: { type: Sequelize.STRING, allowNull: true },
            status: {
              type: Sequelize.ENUM("pending", "approved", "declined", "cancelled"),
              allowNull: false,
              defaultValue: "pending",
            },
            requiredApprovals: { type: Sequelize.INTEGER, allowNull: false },
            approveCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            declineCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            chatMessageId: { type: Sequelize.UUID, allowNull: true },
            transactionId: { type: Sequelize.UUID, allowNull: true },
            decidedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );
      }

      if (!tables.includes("SharedWalletWithdrawalVotes")) {
        await queryInterface.createTable(
          "SharedWalletWithdrawalVotes",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true,
            },
            withdrawalId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "SharedWalletWithdrawals", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            userId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            decision: {
              type: Sequelize.ENUM("approve", "decline"),
              allowNull: false,
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("SharedWalletWithdrawalVotes", ["withdrawalId", "userId"], {
          unique: true,
          name: "shared_wallet_withdrawal_votes_withdrawal_user_unique",
          transaction,
        });
      }

      const transactionsColumns = await queryInterface.describeTable("Transactions", { transaction });

      if (!transactionsColumns.sharedWalletWithdrawalId) {
        await queryInterface.addColumn(
          "Transactions",
          "sharedWalletWithdrawalId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "SharedWalletWithdrawals", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const transactionsColumns = await queryInterface.describeTable("Transactions", { transaction });
      if (transactionsColumns.sharedWalletWithdrawalId) {
        await queryInterface.removeColumn("Transactions", "sharedWalletWithdrawalId", { transaction });
      }

      const tables = await queryInterface.showAllTables({ transaction });

      if (tables.includes("SharedWalletWithdrawalVotes")) {
        await queryInterface.dropTable("SharedWalletWithdrawalVotes", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletWithdrawalVotes_decision"',
          { transaction }
        );
      }

      if (tables.includes("SharedWalletWithdrawals")) {
        await queryInterface.dropTable("SharedWalletWithdrawals", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletWithdrawals_status"',
          { transaction }
        );
      }

      const walletsColumns = await queryInterface.describeTable("Wallets", { transaction });
      if (walletsColumns.sharedWalletId) {
        await queryInterface.removeColumn("Wallets", "sharedWalletId", { transaction });
      }

      const groupsColumns = await queryInterface.describeTable("Groups", { transaction });

      if (groupsColumns.sharedWalletId) {
        await queryInterface.removeColumn("Groups", "sharedWalletId", { transaction });
      }

      if (!groupsColumns.hasSharedWallet) {
        await queryInterface.addColumn(
          "Groups",
          "hasSharedWallet",
          { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          { transaction }
        );
      }

      if (!groupsColumns.withdrawalPolicy) {
        await queryInterface.addColumn(
          "Groups",
          "withdrawalPolicy",
          { type: Sequelize.ENUM("free", "approval"), allowNull: true },
          { transaction }
        );
      }

      if (tables.includes("SharedWalletMembers")) {
        await queryInterface.dropTable("SharedWalletMembers", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletMembers_role"',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletMembers_status"',
          { transaction }
        );
      }

      if (tables.includes("SharedWallets")) {
        await queryInterface.dropTable("SharedWallets", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWallets_withdrawalPolicy"',
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
