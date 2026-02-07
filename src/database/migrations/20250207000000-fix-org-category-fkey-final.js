"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("🔧 Starting foreign key constraint fix...");

      // Get all foreign key constraints on Organizations table
      const [constraints] = await queryInterface.sequelize.query(
        `SELECT constraint_name, table_name 
         FROM information_schema.table_constraints 
         WHERE table_name = 'Organizations' 
         AND constraint_type = 'FOREIGN KEY'`,
        { transaction },
      );

      console.log(
        "📋 Found constraints:",
        JSON.stringify(constraints, null, 2),
      );

      // Drop ALL existing categoryId foreign key constraints
      for (const constraint of constraints) {
        if (constraint.constraint_name.toLowerCase().includes("category")) {
          console.log(`🗑️  Dropping constraint: ${constraint.constraint_name}`);
          try {
            await queryInterface.removeConstraint(
              "Organizations",
              constraint.constraint_name,
              { transaction },
            );
            console.log(`✅ Dropped: ${constraint.constraint_name}`);
          } catch (error) {
            console.log(
              `⚠️  Could not drop ${constraint.constraint_name}:`,
              error.message,
            );
          }
        }
      }

      // Add the correct foreign key constraint pointing to Categories table
      console.log(
        "➕ Adding new foreign key constraint to Categories table...",
      );
      await queryInterface.addConstraint("Organizations", {
        fields: ["categoryId"],
        type: "foreign key",
        name: "Organizations_categoryId_fkey",
        references: {
          table: "Categories",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        transaction,
      });

      await transaction.commit();
      console.log(
        "✅ Successfully fixed Organizations categoryId foreign key to point to Categories table",
      );
    } catch (error) {
      await transaction.rollback();
      console.error(
        "❌ Error fixing Organizations categoryId foreign key:",
        error,
      );
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop the new constraint
      await queryInterface.removeConstraint(
        "Organizations",
        "Organizations_categoryId_fkey",
        { transaction },
      );

      // Restore the old constraint pointing to OrganizationCategories
      await queryInterface.addConstraint("Organizations", {
        fields: ["categoryId"],
        type: "foreign key",
        name: "Organizations_categoryId_fkey",
        references: {
          table: "OrganizationCategories",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
