"use strict";

// Wallet top-ups from mobile money. A TopUp row tracks the provider request
// (pending -> successful | failed | expired); a successful one is credited to the wallet
// as a "topup" Transaction sent from the external-funds wallet.
// Keep EXTERNAL_FUNDS_WALLET_ID in sync with src/services/topUp.service.ts.
const EXTERNAL_FUNDS_WALLET_ID = "00000000-0000-4000-8000-0000000e0001";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const tables = await queryInterface.showAllTables({ transaction });

      if (!tables.includes("TopUps")) {
        await queryInterface.createTable(
          "TopUps",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            walletId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Wallets", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            userId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            organizationId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Organizations", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            currency: { type: Sequelize.STRING, allowNull: false, defaultValue: "RWF" },
            provider: { type: Sequelize.ENUM("mtn_momo", "airtel_money"), allowNull: false },
            phoneNumber: { type: Sequelize.STRING, allowNull: false },
            note: { type: Sequelize.STRING, allowNull: true },
            status: {
              type: Sequelize.ENUM("pending", "successful", "failed", "expired"),
              allowNull: false,
              defaultValue: "pending",
            },
            simulated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            providerReference: { type: Sequelize.STRING, allowNull: true },
            failureReason: { type: Sequelize.STRING, allowNull: true },
            transactionId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Transactions", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            completedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("TopUps", ["walletId", "createdAt"], {
          name: "top_ups_wallet_created_idx",
          transaction,
        });
        await queryInterface.addIndex("TopUps", ["status", "createdAt"], {
          name: "top_ups_status_created_idx",
          transaction,
        });
        await queryInterface.addIndex("TopUps", ["provider", "providerReference"], {
          name: "top_ups_provider_reference_idx",
          transaction,
        });
      }

      const [existingWallet] = await queryInterface.sequelize.query(
        `SELECT id FROM "Wallets" WHERE id = :id`,
        { replacements: { id: EXTERNAL_FUNDS_WALLET_ID }, transaction }
      );
      if (existingWallet.length === 0) {
        await queryInterface.bulkInsert(
          "Wallets",
          [
            {
              id: EXTERNAL_FUNDS_WALLET_ID,
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
      await queryInterface.dropTable("TopUps", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_TopUps_provider"; DROP TYPE IF EXISTS "enum_TopUps_status";',
        { transaction }
      );
      // The external-funds wallet is the sender of every "topup" transaction, so it is only
      // removed when nothing references it.
      await queryInterface.sequelize.query(
        `DELETE FROM "Wallets" WHERE id = :id
           AND NOT EXISTS (SELECT 1 FROM "Transactions" WHERE "senderWalletId" = :id OR "receiverWalletId" = :id)`,
        { replacements: { id: EXTERNAL_FUNDS_WALLET_ID }, transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
