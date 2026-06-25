"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("Wallets");
    if (!tableDesc.publicContributionId) {
      await queryInterface.addColumn("Wallets", "publicContributionId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "PublicContributions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Wallets", "publicContributionId");
  },
};
