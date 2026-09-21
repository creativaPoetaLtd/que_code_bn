"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'settled'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_Escrows_status')
        ) THEN
          ALTER TYPE "enum_Escrows_status" ADD VALUE 'settled';
        END IF;
      END
      $$;
    `);

    await queryInterface.addColumn("Escrows", "proposedByUserId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("Escrows", "proposedPayeeAmount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "proposedPayerAmount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "proposedNote", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "proposedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "settledAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "settlementTransactionId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Transactions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Escrows", "settlementTransactionId");
    await queryInterface.removeColumn("Escrows", "settledAt");
    await queryInterface.removeColumn("Escrows", "proposedAt");
    await queryInterface.removeColumn("Escrows", "proposedNote");
    await queryInterface.removeColumn("Escrows", "proposedPayerAmount");
    await queryInterface.removeColumn("Escrows", "proposedPayeeAmount");
    await queryInterface.removeColumn("Escrows", "proposedByUserId");
    // Postgres does not support removing a value from an enum type; no-op for status.
  },
};
