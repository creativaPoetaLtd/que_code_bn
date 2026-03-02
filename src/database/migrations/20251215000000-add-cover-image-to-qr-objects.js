"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn("QRObjects", "coverImage", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      console.log('Column coverImage already exists or migration failed: ', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("QRObjects", "coverImage");
  },
};

