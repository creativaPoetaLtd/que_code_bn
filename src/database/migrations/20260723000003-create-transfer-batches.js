"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TransferBatches_status') THEN
          CREATE TYPE "enum_TransferBatches_status" AS ENUM ('completed', 'partial', 'failed');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TransferBatches_type') THEN
          CREATE TYPE "enum_TransferBatches_type" AS ENUM ('transfer', 'payment', 'donation', 'vote', 'topup', 'withdrawal');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("TransferBatches", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      createdByUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderOrganizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderSubActionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "SubActions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "RWF",
      },
      type: {
        type: Sequelize.ENUM(
          "transfer",
          "payment",
          "donation",
          "vote",
          "topup",
          "withdrawal"
        ),
        allowNull: false,
        defaultValue: "transfer",
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      applyConstraints: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      idempotencyKey: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      recipientCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      totalRequestedAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      totalSentAmount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        allowNull: false,
      },
      totalFailedAmount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        allowNull: false,
      },
      successCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      failureCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("completed", "partial", "failed"),
        allowNull: false,
        defaultValue: "completed",
      },
      failures: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Array of {receiverUserId?, receiverOrganizationId?, receiverWalletId?, amount, reason} for recipients that were skipped",
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

    await queryInterface.addIndex("TransferBatches", ["createdByUserId"], {
      name: "idx_transfer_batches_created_by",
    });
    await queryInterface.addIndex("TransferBatches", ["status"], {
      name: "idx_transfer_batches_status",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("TransferBatches");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_TransferBatches_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_TransferBatches_type";'
    );
  },
};
