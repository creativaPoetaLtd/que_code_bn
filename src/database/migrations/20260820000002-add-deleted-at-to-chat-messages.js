"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ChatMessages", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("ChatMessages", "deletedBy", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ChatMessages", "deletedBy");
    await queryInterface.removeColumn("ChatMessages", "deletedAt");
  },
};
