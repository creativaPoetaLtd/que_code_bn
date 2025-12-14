"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, clean up any invalid categoryId references
    // Set categoryId to NULL for organizations that reference non-existent categories
    await queryInterface.sequelize.query(`
      UPDATE "Organizations"
      SET "categoryId" = NULL
      WHERE "categoryId" IS NOT NULL
      AND "categoryId" NOT IN (
        SELECT id FROM "OrganizationCategories"
      );
    `);

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