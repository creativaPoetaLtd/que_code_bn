"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "SubActions",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          actionId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "Actions",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          price: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0,
          },
          stock: {
            type: Sequelize.INTEGER,
            allowNull: true, // null = unlimited
          },
          stockReserved: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          variants: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          metadata: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          isActive: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          sortOrder: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
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
        },
        { transaction }
      );

      // Add indexes
      await queryInterface.addIndex("SubActions", ["actionId"], {
        name: "idx_sub_actions_action_id",
        transaction,
      });
      await queryInterface.addIndex("SubActions", ["isActive"], {
        name: "idx_sub_actions_is_active",
        transaction,
      });
      await queryInterface.addIndex("SubActions", ["actionId", "isActive"], {
        name: "idx_sub_actions_action_active",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop foreign key constraint from Transactions if it exists
      await queryInterface.sequelize.query(
        `ALTER TABLE "Transactions" DROP CONSTRAINT IF EXISTS "Transactions_subActionId_fkey";`,
        { transaction }
      );

      // Drop foreign key constraints from QRObjects if table exists
      const tables = await queryInterface.sequelize.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'QRObjects';`,
        { transaction, type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (tables.length > 0) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "QRObjects" DROP CONSTRAINT IF EXISTS "QRObjects_subActionId_fkey";`,
          { transaction }
        );
      }

      // Now we can safely drop the SubActions table
      await queryInterface.dropTable("SubActions", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

