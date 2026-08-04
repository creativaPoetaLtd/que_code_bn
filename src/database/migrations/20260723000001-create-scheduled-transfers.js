"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ScheduledTransfers_status') THEN
          CREATE TYPE "enum_ScheduledTransfers_status" AS ENUM ('scheduled', 'held', 'executing', 'completed', 'failed', 'cancelled', 'paused');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ScheduledTransfers_type') THEN
          CREATE TYPE "enum_ScheduledTransfers_type" AS ENUM ('transfer', 'payment', 'donation', 'vote', 'topup', 'withdrawal');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("ScheduledTransfers", {
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
      receiverUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      receiverOrganizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      receiverWalletId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      fee: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        allowNull: false,
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
      scheduledFor: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      timezone: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "Africa/Kigali",
      },
      recurrenceRule: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment:
          "null for one-time transfers. Otherwise {frequency, interval, endDate?, maxOccurrences?}",
      },
      occurrenceCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(
          "scheduled",
          "held",
          "executing",
          "completed",
          "failed",
          "cancelled",
          "paused"
        ),
        defaultValue: "scheduled",
        allowNull: false,
      },
      heldAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      heldAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      idempotencyKey: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      lastExecutedTransactionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Transactions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      consecutiveFailureCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      lastFailureReason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pinVerifiedAt: {
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

    await queryInterface.addIndex("ScheduledTransfers", ["createdByUserId"], {
      name: "idx_scheduled_transfers_created_by",
    });
    await queryInterface.addIndex("ScheduledTransfers", ["status", "scheduledFor"], {
      name: "idx_scheduled_transfers_status_scheduled_for",
    });
    await queryInterface.addIndex("ScheduledTransfers", ["senderUserId"], {
      name: "idx_scheduled_transfers_sender_user_id",
    });
    await queryInterface.addIndex("ScheduledTransfers", ["receiverUserId"], {
      name: "idx_scheduled_transfers_receiver_user_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ScheduledTransfers");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ScheduledTransfers_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ScheduledTransfers_type";'
    );
  },
};
