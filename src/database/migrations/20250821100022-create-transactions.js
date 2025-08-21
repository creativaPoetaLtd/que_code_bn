"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum types
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Transactions_status') THEN
          CREATE TYPE "enum_Transactions_status" AS ENUM ('pending', 'completed', 'failed', 'cancelled');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Transactions_type') THEN
          CREATE TYPE "enum_Transactions_type" AS ENUM ('transfer', 'payment', 'donation', 'vote', 'topup', 'withdrawal');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Transactions_externalSenderProvider') THEN
          CREATE TYPE "enum_Transactions_externalSenderProvider" AS ENUM ('mtn_momo', 'airtel_money', 'bank', 'visa', 'mastercard', 'paypal', 'other');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Transactions_spendConstraintType') THEN
          CREATE TYPE "enum_Transactions_spendConstraintType" AS ENUM ('none', 'category', 'recipient');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("Transactions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      referenceId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      senderWalletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      receiverWalletId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Wallets",
          key: "id",
        },
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
      totalAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "completed", "failed", "cancelled"),
        defaultValue: "pending",
        allowNull: false,
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
      },
      externalSenderName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      externalSenderContact: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      externalSenderProvider: {
        type: Sequelize.ENUM(
          "mtn_momo",
          "airtel_money",
          "bank",
          "visa",
          "mastercard",
          "paypal",
          "other"
        ),
        allowNull: true,
      },
      externalSenderReference: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "TransactionCategories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      spendConstraintType: {
        type: Sequelize.ENUM("none", "category", "recipient"),
        allowNull: true,
      },
      constraintCategoryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "TransactionCategories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      constraintRecipientWalletId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      hasAccount: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      senderNames: {
        type: Sequelize.STRING,
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

    // Add indexes
    await queryInterface.addIndex("Transactions", ["senderWalletId"], {
      name: "idx_transactions_sender_wallet_id",
    });
    await queryInterface.addIndex("Transactions", ["receiverWalletId"], {
      name: "idx_transactions_receiver_wallet_id",
    });
    await queryInterface.addIndex("Transactions", ["referenceId"], {
      name: "idx_transactions_reference_id",
    });
    await queryInterface.addIndex("Transactions", ["status"], {
      name: "idx_transactions_status",
    });
    await queryInterface.addIndex("Transactions", ["type"], {
      name: "idx_transactions_type",
    });
    await queryInterface.addIndex("Transactions", ["categoryId"], {
      name: "idx_transactions_category_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Transactions");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Transactions_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Transactions_type";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Transactions_externalSenderProvider";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Transactions_spendConstraintType";'
    );
  },
};
