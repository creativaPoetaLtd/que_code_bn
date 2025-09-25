"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Organizations", "categoryId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "Categories",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add index for categoryId
    await queryInterface.addIndex("Organizations", ["categoryId"], {
      name: "idx_organizations_category_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "Organizations",
      "idx_organizations_category_id"
    );
    await queryInterface.removeColumn("Organizations", "categoryId");
  },
};
