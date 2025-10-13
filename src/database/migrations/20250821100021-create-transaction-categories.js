"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if Categories table exists, create it if it doesn't
    const [categoriesExists] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Categories'
      );
    `);
    
    if (!categoriesExists[0].exists) {
      // Create Categories table first
      await queryInterface.createTable("Categories", {
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
          type: Sequelize.TEXT,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
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
      console.log("✅ Created Categories table");
    }

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
        references: {
          model: "Categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
    await queryInterface.addIndex("TransactionCategories", ["name"], {
      name: "idx_transaction_categories_name",
    });
    await queryInterface.addIndex(
      "TransactionCategories",
      ["requiresOrgCategoryId"],
      {
        name: "idx_transaction_categories_requires_org_category_id",
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("TransactionCategories");
  },
};
