"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ExternalAccounts_provider') THEN
          CREATE TYPE "enum_ExternalAccounts_provider" AS ENUM ('mtn_momo', 'airtel_money', 'visa', 'mastercard', 'bank');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("ExternalAccounts", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      provider: {
        type: Sequelize.ENUM(
          "mtn_momo",
          "airtel_money",
          "visa",
          "mastercard",
          "bank"
        ),
        allowNull: false,
      },
      accountNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      providerRef: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      label: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
    await queryInterface.addIndex("ExternalAccounts", ["userId"], {
      name: "idx_external_accounts_user_id",
    });
    await queryInterface.addIndex("ExternalAccounts", ["organizationId"], {
      name: "idx_external_accounts_organization_id",
    });
    await queryInterface.addIndex("ExternalAccounts", ["provider"], {
      name: "idx_external_accounts_provider",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("ExternalAccounts");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ExternalAccounts_provider";'
    );
  },
};
