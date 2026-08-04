"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Transactions", "scheduledTransferId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "ScheduledTransfers", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("Transactions", ["scheduledTransferId"], {
      name: "idx_transactions_scheduled_transfer_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex(
      "Transactions",
      "idx_transactions_scheduled_transfer_id"
    );
    await queryInterface.removeColumn("Transactions", "scheduledTransferId");
  },
};
