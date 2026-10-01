"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const tables = await queryInterface.showAllTables({ transaction });

      if (!tables.includes("Bills")) {
        await queryInterface.createTable(
          "Bills",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            organizerId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            recipientUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            recipientOrganizationId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Organizations", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            totalAmount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            currency: { type: Sequelize.STRING, allowNull: false, defaultValue: "RWF" },
            title: { type: Sequelize.STRING, allowNull: false },
            note: { type: Sequelize.STRING, allowNull: true },
            status: {
              type: Sequelize.ENUM("open", "completed", "cancelled"),
              allowNull: false,
              defaultValue: "open",
            },
            completedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("Bills", ["organizerId"], {
          name: "bills_organizer_idx",
          transaction,
        });
      }

      if (!tables.includes("BillShares")) {
        await queryInterface.createTable(
          "BillShares",
          {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            billId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Bills", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            payerId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
            status: {
              type: Sequelize.ENUM("pending", "paid", "covered", "declined", "closed", "cancelled"),
              allowNull: false,
              defaultValue: "pending",
            },
            paidByUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            // Plain UUID (no FK): Transactions.billShareId already points the other way.
            transactionId: { type: Sequelize.UUID, allowNull: true },
            declineNote: { type: Sequelize.STRING, allowNull: true },
            lastRemindedAt: { type: Sequelize.DATE, allowNull: true },
            settledAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
          },
          { transaction }
        );

        await queryInterface.addIndex("BillShares", ["billId", "payerId"], {
          unique: true,
          name: "bill_shares_bill_payer_unique",
          transaction,
        });
        await queryInterface.addIndex("BillShares", ["payerId"], {
          name: "bill_shares_payer_idx",
          transaction,
        });
      }

      const transactionsColumns = await queryInterface.describeTable("Transactions", { transaction });
      if (!transactionsColumns.billShareId) {
        await queryInterface.addColumn(
          "Transactions",
          "billShareId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "BillShares", key: "id" },
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
      if (transactionsColumns.billShareId) {
        await queryInterface.removeColumn("Transactions", "billShareId", { transaction });
      }

      const tables = await queryInterface.showAllTables({ transaction });

      if (tables.includes("BillShares")) {
        await queryInterface.dropTable("BillShares", { transaction });
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_BillShares_status"', { transaction });
      }

      if (tables.includes("Bills")) {
        await queryInterface.dropTable("Bills", { transaction });
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Bills_status"', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
