"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "ActionPurchases",
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
          subActionId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "SubActions",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          buyerId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "Users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          organizationId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "Organizations",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          transactionId: {
            type: Sequelize.UUID,
            allowNull: false,
            unique: true,
            references: {
              model: "Transactions",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          unitPrice: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
          },
          totalAmount: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
          },
          currency: {
            type: Sequelize.STRING(3),
            allowNull: false,
            defaultValue: "RWF",
          },
          buyerData: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          status: {
            type: Sequelize.ENUM(
              "pending",
              "completed",
              "cancelled",
              "refunded"
            ),
            defaultValue: "pending",
            allowNull: false,
          },
          qrObjectId: {
            type: Sequelize.UUID,
            allowNull: true,
            // Foreign key will be added in a later migration after QRObjects table is created
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
      await queryInterface.addIndex("ActionPurchases", ["actionId"], {
        name: "idx_action_purchases_action_id",
        transaction,
      });
      await queryInterface.addIndex("ActionPurchases", ["buyerId"], {
        name: "idx_action_purchases_buyer_id",
        transaction,
      });
      await queryInterface.addIndex("ActionPurchases", ["organizationId"], {
        name: "idx_action_purchases_organization_id",
        transaction,
      });
      await queryInterface.addIndex("ActionPurchases", ["transactionId"], {
        name: "idx_action_purchases_transaction_id",
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("ActionPurchases", ["status"], {
        name: "idx_action_purchases_status",
        transaction,
      });
      await queryInterface.addIndex("ActionPurchases", ["buyerId", "status"], {
        name: "idx_action_purchases_buyer_status",
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
      await queryInterface.dropTable("ActionPurchases", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_ActionPurchases_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

