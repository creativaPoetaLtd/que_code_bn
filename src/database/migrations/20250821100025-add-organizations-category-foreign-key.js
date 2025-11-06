"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add foreign key constraint for categoryId to OrganizationCategories
    await queryInterface.addConstraint("Organizations", {
      fields: ["categoryId"],
      type: "foreign key",
      name: "fk_organizations_category",
      references: {
        table: "OrganizationCategories",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint
    await queryInterface.removeConstraint("Organizations", "fk_organizations_category");
  },
};