"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_VerificationTokens_type') THEN
          CREATE TYPE "enum_VerificationTokens_type" AS ENUM ('password_reset', 'email_verification', 'phone_verification');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("VerificationTokens", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      type: {
        type: Sequelize.ENUM(
          "password_reset",
          "email_verification",
          "phone_verification"
        ),
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex("VerificationTokens", ["userId"], {
      name: "idx_verification_tokens_user_id",
    });
    await queryInterface.addIndex("VerificationTokens", ["token"], {
      name: "idx_verification_tokens_token",
    });
    await queryInterface.addIndex("VerificationTokens", ["expiresAt"], {
      name: "idx_verification_tokens_expires_at",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("VerificationTokens");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_VerificationTokens_type";'
    );
  },
};
