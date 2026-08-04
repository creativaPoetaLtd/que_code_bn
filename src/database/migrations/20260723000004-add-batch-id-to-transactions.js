"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Transactions", "batchId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "TransferBatches", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("Transactions", ["batchId"], {
      name: "idx_transactions_batch_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("Transactions", "idx_transactions_batch_id");
    await queryInterface.removeColumn("Transactions", "batchId");
  },
};
