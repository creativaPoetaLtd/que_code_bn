"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("OrganizationCategories", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("OrganizationCategories", ["name"], {
      name: "idx_organization_categories_name",
      unique: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop foreign key constraint from Organizations if it exists
      await queryInterface.sequelize.query(
        `ALTER TABLE "Organizations" DROP CONSTRAINT IF EXISTS "Organizations_categoryId_fkey";`,
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        `ALTER TABLE "Organizations" DROP CONSTRAINT IF EXISTS "fk_organizations_category";`,
        { transaction }
      );

      // Now we can safely drop the table
      await queryInterface.dropTable("OrganizationCategories", { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
