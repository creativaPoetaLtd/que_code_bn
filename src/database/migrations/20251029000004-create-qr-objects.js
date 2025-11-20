"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "QRObjects",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
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
          actionPurchaseId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "ActionPurchases",
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
          type: {
            type: Sequelize.ENUM(
              "eticket",
              "badge",
              "license",
              "membership",
              "booking",
              "transport",
              "subscription"
            ),
            allowNull: false,
          },
          metadata: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          status: {
            type: Sequelize.ENUM("valid", "used", "expired", "revoked"),
            defaultValue: "valid",
            allowNull: false,
          },
          issuedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW,
          },
          validUntil: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          usedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          qrCodeData: {
            type: Sequelize.TEXT,
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
        },
        { transaction }
      );

      // Add indexes
      await queryInterface.addIndex("QRObjects", ["buyerId"], {
        name: "idx_qr_objects_buyer_id",
        transaction,
      });
      await queryInterface.addIndex("QRObjects", ["actionId"], {
        name: "idx_qr_objects_action_id",
        transaction,
      });
      await queryInterface.addIndex("QRObjects", ["actionPurchaseId"], {
        name: "idx_qr_objects_action_purchase_id",
        transaction,
      });
      await queryInterface.addIndex("QRObjects", ["status"], {
        name: "idx_qr_objects_status",
        transaction,
      });
      await queryInterface.addIndex("QRObjects", ["buyerId", "status"], {
        name: "idx_qr_objects_buyer_status",
        transaction,
      });
      await queryInterface.addIndex("QRObjects", ["type"], {
        name: "idx_qr_objects_type",
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
      await queryInterface.dropTable("QRObjects", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_QRObjects_type";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_QRObjects_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

