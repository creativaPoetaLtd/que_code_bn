"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Actions", "metadata", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Actions", "metadata");
  },
};
