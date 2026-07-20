"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("GroupContributionPayments");

    if (!tableDesc.isAnonymous) {
      await queryInterface.addColumn("GroupContributionPayments", "isAnonymous", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("GroupContributionPayments", "isAnonymous");
  },
};
