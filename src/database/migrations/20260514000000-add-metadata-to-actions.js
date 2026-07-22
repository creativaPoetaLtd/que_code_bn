"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("Actions");
    if (tableDesc.metadata) return;
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
