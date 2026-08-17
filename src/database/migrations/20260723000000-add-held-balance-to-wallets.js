"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Wallets", "heldBalance", {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Wallets", "heldBalance");
  },
};
