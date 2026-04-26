"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Wallets", "subActionId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "SubActions",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Wallets", "subActionId");
  },
};
