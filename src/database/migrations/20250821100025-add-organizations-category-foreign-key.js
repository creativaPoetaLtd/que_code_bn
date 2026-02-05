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

    // Check if constraint already exists
    const [results] = await queryInterface.sequelize.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'Organizations' AND constraint_name = 'fk_organizations_category'
    `);
    const constraintExists = results.length > 0;

    // Add foreign key constraint for categoryId to OrganizationCategories only if it doesn't exist
    if (!constraintExists) {
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
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if constraint exists before trying to remove it
    const [results] = await queryInterface.sequelize.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'Organizations' AND constraint_name = 'fk_organizations_category'
    `);
    const constraintExists = results.length > 0;

    // Remove foreign key constraint only if it exists
    if (constraintExists) {
      await queryInterface.removeConstraint("Organizations", "fk_organizations_category");
    }
  },
};