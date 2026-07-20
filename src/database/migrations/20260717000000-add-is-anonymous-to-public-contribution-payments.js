"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("PublicContributionPayments");

    if (!tableDesc.isAnonymous) {
      await queryInterface.addColumn("PublicContributionPayments", "isAnonymous", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("PublicContributionPayments", "isAnonymous");
  },
};
