"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables({ transaction });

      if (!tables.includes("SharedWalletPolicyChanges")) {
        await queryInterface.createTable(
          "SharedWalletPolicyChanges",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            sharedWalletId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "SharedWallets", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            proposedByUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            targetPolicy: { type: Sequelize.ENUM("free", "approval"), allowNull: false },
            status: {
              type: Sequelize.ENUM("pending", "approved", "declined", "cancelled"),
              allowNull: false,
              defaultValue: "pending",
            },
            requiredApprovals: { type: Sequelize.INTEGER, allowNull: false },
            approveCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            declineCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            decidedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );
      }

      if (!tables.includes("SharedWalletPolicyChangeVotes")) {
        await queryInterface.createTable(
          "SharedWalletPolicyChangeVotes",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            policyChangeId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "SharedWalletPolicyChanges", key: "id" },
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
            decision: { type: Sequelize.ENUM("approve", "decline"), allowNull: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("SharedWalletPolicyChangeVotes", ["policyChangeId", "userId"], {
          unique: true,
          name: "shared_wallet_policy_change_votes_unique",
          transaction,
        });
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
      const tables = await queryInterface.showAllTables({ transaction });

      if (tables.includes("SharedWalletPolicyChangeVotes")) {
        await queryInterface.dropTable("SharedWalletPolicyChangeVotes", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletPolicyChangeVotes_decision"',
          { transaction }
        );
      }

      if (tables.includes("SharedWalletPolicyChanges")) {
        await queryInterface.dropTable("SharedWalletPolicyChanges", { transaction });
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletPolicyChanges_status"',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_SharedWalletPolicyChanges_targetPolicy"',
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
