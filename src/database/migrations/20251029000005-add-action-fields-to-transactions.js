"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check if columns already exist
      const tableDescription = await queryInterface.describeTable("Transactions");

      if (!tableDescription.actionPurchaseId) {
        await queryInterface.addColumn(
          "Transactions",
          "actionPurchaseId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "ActionPurchases",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      if (!tableDescription.actionId) {
        await queryInterface.addColumn(
          "Transactions",
          "actionId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "Actions",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      if (!tableDescription.subActionId) {
        await queryInterface.addColumn(
          "Transactions",
          "subActionId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "SubActions",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      // Add foreign key for qrObjectId in ActionPurchases (after QRObjects table exists)
      const actionPurchasesDescription = await queryInterface.describeTable("ActionPurchases");
      if (actionPurchasesDescription.qrObjectId && !actionPurchasesDescription.qrObjectId.references) {
        try {
          await queryInterface.sequelize.query(
            `ALTER TABLE "ActionPurchases" 
            ADD CONSTRAINT "ActionPurchases_qrObjectId_fkey" 
            FOREIGN KEY ("qrObjectId") 
            REFERENCES "QRObjects"("id") 
            ON UPDATE CASCADE ON DELETE SET NULL;`,
            { transaction }
          );
        } catch (e) {
          console.log('Constraint ActionPurchases_qrObjectId_fkey already exists or migration failed: ', e.message);
        }
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
      // Remove the foreign key constraint from ActionPurchases
      await queryInterface.sequelize.query(
        `ALTER TABLE "ActionPurchases" DROP CONSTRAINT IF EXISTS "ActionPurchases_qrObjectId_fkey";`,
        { transaction }
      );

      await queryInterface.removeColumn("Transactions", "actionPurchaseId", {
        transaction,
      });
      await queryInterface.removeColumn("Transactions", "actionId", {
        transaction,
      });
      await queryInterface.removeColumn("Transactions", "subActionId", {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

