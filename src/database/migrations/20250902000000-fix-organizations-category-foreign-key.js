"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper to check if constraint exists
      const constraintExists = async (constraintName) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT constraint_name FROM information_schema.table_constraints 
           WHERE table_name = 'Organizations' AND constraint_name = '${constraintName}'`,
          { transaction }
        );
        return results.length > 0;
      };

      // Drop the existing foreign key constraint that points to OrganizationCategories
      if (await constraintExists("fk_organizations_category")) {
        await queryInterface.removeConstraint(
          "Organizations",
          "fk_organizations_category",
          { transaction }
        );
      }

      // Add new foreign key constraint that points to Categories table
      if (!(await constraintExists("fk_organizations_category"))) {
        await queryInterface.addConstraint("Organizations", {
          fields: ["categoryId"],
          type: "foreign key",
          name: "fk_organizations_category",
          references: {
            table: "Categories",
            field: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          transaction,
        });
      }

      await transaction.commit();
      console.log("✅ Fixed Organizations categoryId foreign key to point to Categories table");
    } catch (error) {
      await transaction.rollback();
      console.error("❌ Error fixing Organizations categoryId foreign key:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if Organizations table exists
      const [tableExists] = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Organizations')`,
        { transaction }
      );

      if (!tableExists[0].exists) {
        console.log("Organizations table doesn't exist, skipping migration revert");
        await transaction.commit();
        return;
      }

      // Helper to check if constraint exists
      const constraintExists = async (constraintName) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT constraint_name FROM information_schema.table_constraints 
           WHERE table_name = 'Organizations' AND constraint_name = '${constraintName}'`,
          { transaction }
        );
        return results.length > 0;
      };

      // Drop the new foreign key constraint
      if (await constraintExists("fk_organizations_category")) {
        await queryInterface.removeConstraint(
          "Organizations",
          "fk_organizations_category",
          { transaction }
        );
      }

      // Check if OrganizationCategories table exists before restoring FK
      const [orgCategoriesExists] = await queryInterface.sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'OrganizationCategories')`,
        { transaction }
      );

      // Restore the old foreign key constraint only if target table exists
      if (orgCategoriesExists[0].exists && !(await constraintExists("fk_organizations_category"))) {
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
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
