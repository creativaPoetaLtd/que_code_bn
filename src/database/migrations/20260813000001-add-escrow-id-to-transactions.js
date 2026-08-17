"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Transactions", "escrowId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Escrows", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("Transactions", ["escrowId"], {
      name: "idx_transactions_escrow_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("Transactions", "idx_transactions_escrow_id");
    await queryInterface.removeColumn("Transactions", "escrowId");
  },
};
