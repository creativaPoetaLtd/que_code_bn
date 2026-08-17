"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Escrows", "disputeResponse", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Escrows", "disputeRespondedBy", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("Escrows", "disputeRespondedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Escrows", "disputeRespondedAt");
    await queryInterface.removeColumn("Escrows", "disputeRespondedBy");
    await queryInterface.removeColumn("Escrows", "disputeResponse");
  },
};
