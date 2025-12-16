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

      // Restore the old foreign key constraint pointing to OrganizationCategories
      if (!(await constraintExists("fk_organizations_category"))) {
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
