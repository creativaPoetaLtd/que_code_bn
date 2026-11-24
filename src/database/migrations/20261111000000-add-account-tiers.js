"use strict";

// QC account types: tier column on Users/Organizations, monthly plan subscriptions,
// admin "on demand" feature grants, and the platform wallet that collects fees.
// Keep PLATFORM_WALLET_ID in sync with src/services/accountTier.service.ts.
const PLATFORM_WALLET_ID = "00000000-0000-4000-8000-00000000fee0";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const tables = await queryInterface.showAllTables({ transaction });

      const userColumns = await queryInterface.describeTable("Users", { transaction });
      if (!userColumns.accountTier) {
        await queryInterface.addColumn(
          "Users",
          "accountTier",
          {
            type: Sequelize.ENUM("STARTER", "PREMIUM", "VIP", "FREELANCE", "AGENT"),
            allowNull: false,
            defaultValue: "STARTER",
          },
          { transaction }
        );
      }

      const orgColumns = await queryInterface.describeTable("Organizations", { transaction });
      if (!orgColumns.accountTier) {
        await queryInterface.addColumn(
          "Organizations",
          "accountTier",
          {
            type: Sequelize.ENUM("BUSINESS", "NPO"),
            allowNull: false,
            defaultValue: "BUSINESS",
          },
          { transaction }
        );
      }

      if (!tables.includes("AccountSubscriptions")) {
        await queryInterface.createTable(
          "AccountSubscriptions",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            userId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            organizationId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Organizations", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            tier: { type: Sequelize.STRING, allowNull: false },
            // Tier to switch to when the current period ends (scheduled downgrade).
            pendingTier: { type: Sequelize.STRING, allowNull: true },
            priceRwf: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            status: {
              type: Sequelize.ENUM("active", "past_due", "cancelled", "expired"),
              allowNull: false,
              defaultValue: "active",
            },
            autoRenew: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            currentPeriodStart: { type: Sequelize.DATE, allowNull: false },
            currentPeriodEnd: { type: Sequelize.DATE, allowNull: false },
            pastDueSince: { type: Sequelize.DATE, allowNull: true },
            lastChargeTransactionId: { type: Sequelize.UUID, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("AccountSubscriptions", ["userId"], {
          name: "account_subscriptions_user_idx",
          transaction,
        });
        await queryInterface.addIndex("AccountSubscriptions", ["organizationId"], {
          name: "account_subscriptions_org_idx",
          transaction,
        });
        await queryInterface.addIndex("AccountSubscriptions", ["status", "currentPeriodEnd"], {
          name: "account_subscriptions_due_idx",
          transaction,
        });
      }

      if (!tables.includes("FeatureGrants")) {
        await queryInterface.createTable(
          "FeatureGrants",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            userId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            organizationId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Organizations", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            // A FeatureKey from src/utils/accountTiers.ts, or "dailyTransferLimit".
            feature: { type: Sequelize.STRING, allowNull: false },
            // Per-use fee for a granted feature (null = free).
            fee: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
            // Custom limit for feature "dailyTransferLimit" (null = unlimited).
            limitAmount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            expiresAt: { type: Sequelize.DATE, allowNull: true },
            note: { type: Sequelize.STRING, allowNull: true },
            grantedByUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("FeatureGrants", ["userId", "feature"], {
          name: "feature_grants_user_feature_idx",
          transaction,
        });
        await queryInterface.addIndex("FeatureGrants", ["organizationId", "feature"], {
          name: "feature_grants_org_feature_idx",
          transaction,
        });
      }

      const [existingPlatformWallet] = await queryInterface.sequelize.query(
        `SELECT id FROM "Wallets" WHERE id = :id`,
        { replacements: { id: PLATFORM_WALLET_ID }, transaction }
      );
      if (existingPlatformWallet.length === 0) {
        await queryInterface.bulkInsert(
          "Wallets",
          [
            {
              id: PLATFORM_WALLET_ID,
              balance: 0,
              heldBalance: 0,
              currency: "RWF",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.bulkDelete("Wallets", { id: PLATFORM_WALLET_ID }, { transaction });
      await queryInterface.dropTable("FeatureGrants", { transaction });
      await queryInterface.dropTable("AccountSubscriptions", { transaction });
      await queryInterface.removeColumn("Organizations", "accountTier", { transaction });
      await queryInterface.removeColumn("Users", "accountTier", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_AccountSubscriptions_status"; DROP TYPE IF EXISTS "enum_Organizations_accountTier"; DROP TYPE IF EXISTS "enum_Users_accountTier";',
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
