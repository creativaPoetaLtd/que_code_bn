"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Step 1: Create new Categories table
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
      }, { transaction });

      // Step 2: Migrate data from old tables (only if they exist)
      
      // Check if TransactionCategories table exists
      const [transactionCategoriesExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'TransactionCategories'
        );
      `, { transaction });
      
      if (transactionCategoriesExists[0].exists) {
        await queryInterface.sequelize.query(`
          INSERT INTO "Categories" (id, name, description, "isActive", "createdAt", "updatedAt")
          SELECT id, name, description, true, "createdAt", "updatedAt"
          FROM "TransactionCategories"
        `, { transaction });
      }

      // Check if OrganizationCategories table exists
      const [organizationCategoriesExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'OrganizationCategories'
        );
      `, { transaction });
      
      if (organizationCategoriesExists[0].exists) {
        await queryInterface.sequelize.query(`
          INSERT INTO "Categories" (id, name, description, "isActive", "createdAt", "updatedAt")
          SELECT id, name, description, true, "createdAt", "updatedAt"
          FROM "OrganizationCategories"
          WHERE name NOT IN (SELECT name FROM "Categories")
        `, { transaction });
      }

      // Step 3: Add new category columns (only if target tables exist)
      
      // Check if Organizations table exists
      const [organizationsExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
        );
      `, { transaction });
      
      if (organizationsExists[0].exists) {
        await queryInterface.addColumn("Organizations", "newCategoryId", {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "Categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        }, { transaction });
      }

      // Check if Transactions table exists
      const [transactionsExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'Transactions'
        );
      `, { transaction });
      
      if (transactionsExists[0].exists) {
        await queryInterface.addColumn("Transactions", "newCategoryId", {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "Categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        }, { transaction });
      }

      // Check if WalletRestrictions table exists
      const [walletRestrictionsExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'WalletRestrictions'
        );
      `, { transaction });
      
      if (walletRestrictionsExists[0].exists) {
        await queryInterface.addColumn("WalletRestrictions", "newCategoryId", {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "Categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        }, { transaction });
      }

      // Step 4: Update foreign key references (only if both tables exist)
      
      if (organizationsExists[0].exists && organizationCategoriesExists[0].exists) {
        await queryInterface.sequelize.query(`
          UPDATE "Organizations" 
          SET "newCategoryId" = (
            SELECT id FROM "Categories" 
            WHERE "Categories".name = (
              SELECT name FROM "OrganizationCategories" 
              WHERE "OrganizationCategories".id = "Organizations"."categoryId"
            )
          )
        `, { transaction });
      }

      if (transactionsExists[0].exists && transactionCategoriesExists[0].exists) {
        await queryInterface.sequelize.query(`
          UPDATE "Transactions" 
          SET "newCategoryId" = (
            SELECT id FROM "Categories" 
            WHERE "Categories".name = (
              SELECT name FROM "TransactionCategories" 
              WHERE "TransactionCategories".id = "Transactions"."categoryId"
            )
          )
        `, { transaction });
      }

      if (walletRestrictionsExists[0].exists && transactionCategoriesExists[0].exists) {
        await queryInterface.sequelize.query(`
          UPDATE "WalletRestrictions" 
          SET "newCategoryId" = (
            SELECT id FROM "Categories" 
            WHERE "Categories".name = (
              SELECT name FROM "TransactionCategories" 
              WHERE "TransactionCategories".id = "WalletRestrictions"."categoryId"
            )
          )
        `, { transaction });
      }

      // Step 5: Drop old foreign key columns (only if they exist)
      if (organizationsExists[0].exists) {
        try {
          await queryInterface.removeColumn("Organizations", "categoryId", { transaction });
        } catch (error) {
          console.log("Organizations.categoryId column doesn't exist, skipping removal");
        }
      }
      
      if (transactionsExists[0].exists) {
        try {
          await queryInterface.removeColumn("Transactions", "categoryId", { transaction });
        } catch (error) {
          console.log("Transactions.categoryId column doesn't exist, skipping removal");
        }
      }
      
      if (walletRestrictionsExists[0].exists) {
        try {
          await queryInterface.removeColumn("WalletRestrictions", "categoryId", { transaction });
        } catch (error) {
          console.log("WalletRestrictions.categoryId column doesn't exist, skipping removal");
        }
      }

      // Step 6: Rename new columns (only if they exist)
      if (organizationsExists[0].exists) {
        try {
          await queryInterface.renameColumn("Organizations", "newCategoryId", "categoryId", { transaction });
        } catch (error) {
          console.log("Organizations.newCategoryId column doesn't exist, skipping rename");
        }
      }
      
      if (transactionsExists[0].exists) {
        try {
          await queryInterface.renameColumn("Transactions", "newCategoryId", "categoryId", { transaction });
        } catch (error) {
          console.log("Transactions.newCategoryId column doesn't exist, skipping rename");
        }
      }
      
      if (walletRestrictionsExists[0].exists) {
        try {
          await queryInterface.renameColumn("WalletRestrictions", "newCategoryId", "categoryId", { transaction });
        } catch (error) {
          console.log("WalletRestrictions.newCategoryId column doesn't exist, skipping rename");
        }
      }

      // Step 7: Drop old tables (constraints will be automatically dropped)
      try {
        await queryInterface.dropTable("TransactionCategories", { transaction });
      } catch (error) {
        console.log("TransactionCategories table may not exist or has dependencies");
      }
      
      try {
        await queryInterface.dropTable("OrganizationCategories", { transaction });
      } catch (error) {
        console.log("OrganizationCategories table may not exist or has dependencies");
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
      // Recreate old tables
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

      // Restore old foreign key columns
      await queryInterface.addColumn("Organizations", "oldCategoryId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "OrganizationCategories",
          key: "id",
        },
      }, { transaction });

      await queryInterface.addColumn("Transactions", "oldCategoryId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "TransactionCategories",
          key: "id",
        },
      }, { transaction });

      await queryInterface.addColumn("WalletRestrictions", "oldCategoryId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "TransactionCategories",
          key: "id",
        },
      }, { transaction });

      // Drop new columns
      await queryInterface.removeColumn("Organizations", "categoryId", { transaction });
      await queryInterface.removeColumn("Transactions", "categoryId", { transaction });
      await queryInterface.removeColumn("WalletRestrictions", "categoryId", { transaction });

      // Rename old columns back
      await queryInterface.renameColumn("Organizations", "oldCategoryId", "categoryId", { transaction });
      await queryInterface.renameColumn("Transactions", "oldCategoryId", "categoryId", { transaction });
      await queryInterface.renameColumn("WalletRestrictions", "oldCategoryId", "categoryId", { transaction });

      // Drop new table
      await queryInterface.dropTable("Categories", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
