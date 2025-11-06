"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop old category tables if they exist
      try {
        await queryInterface.dropTable("TransactionCategories", { transaction });
        console.log("✅ TransactionCategories table dropped successfully");
      } catch (error) {
        console.log("ℹ️ TransactionCategories table may not exist or already dropped");
      }
      
      try {
        await queryInterface.dropTable("OrganizationCategories", { transaction });
        console.log("✅ OrganizationCategories table dropped successfully");
      } catch (error) {
        console.log("ℹ️ OrganizationCategories table may not exist or already dropped");
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Recreate old tables if needed (for rollback)
      await queryInterface.createTable("TransactionCategories", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        isRestricted: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        requiresOrgCategoryId: {
          type: Sequelize.UUID,
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
      }, { transaction });

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
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
