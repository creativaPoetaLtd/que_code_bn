"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("Wallets");
    if (!tableDesc.subActionId) {
      await queryInterface.addColumn("Wallets", "subActionId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "SubActions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Wallets", "subActionId");
  },
};
