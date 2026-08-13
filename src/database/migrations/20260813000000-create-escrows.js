"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Escrows_status') THEN
          CREATE TYPE "enum_Escrows_status" AS ENUM ('held', 'released', 'refunded', 'disputed', 'cancelled', 'expired');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Escrows_releaseMode') THEN
          CREATE TYPE "enum_Escrows_releaseMode" AS ENUM ('manual', 'auto_timeout');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("Escrows", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      chatId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Chats", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      payerWalletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      payeeWalletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      payerUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      payeeUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "RWF",
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "held",
          "released",
          "refunded",
          "disputed",
          "cancelled",
          "expired"
        ),
        defaultValue: "held",
        allowNull: false,
      },
      releaseMode: {
        type: Sequelize.ENUM("manual", "auto_timeout"),
        defaultValue: "manual",
        allowNull: false,
      },
      autoReleaseAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fundedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      releasedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refundedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      releaseTransactionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Transactions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      disputeRaisedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      disputeReason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      disputeRaisedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolvedByAdminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      resolutionNote: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      resolvedAt: {
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

    await queryInterface.addIndex("Escrows", ["payerWalletId"], {
      name: "idx_escrows_payer_wallet_id",
    });
    await queryInterface.addIndex("Escrows", ["payeeWalletId"], {
      name: "idx_escrows_payee_wallet_id",
    });
    await queryInterface.addIndex("Escrows", ["status", "releaseMode", "autoReleaseAt"], {
      name: "idx_escrows_status_release_mode_auto_release_at",
    });
    await queryInterface.addIndex("Escrows", ["chatId"], {
      name: "idx_escrows_chat_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Escrows");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Escrows_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Escrows_releaseMode";'
    );
  },
};
