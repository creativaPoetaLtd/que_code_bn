"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add description column
    await queryInterface.addColumn("Organizations", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add address column
    await queryInterface.addColumn("Organizations", "address", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add services column (JSON array)
    await queryInterface.addColumn("Organizations", "services", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn("Organizations", "description");
    await queryInterface.removeColumn("Organizations", "address");
    await queryInterface.removeColumn("Organizations", "services");
  },
};

