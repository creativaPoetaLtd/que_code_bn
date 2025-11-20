"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        "Actions",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
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
          type: {
            type: Sequelize.ENUM(
              "ticket",
              "transport",
              "service",
              "subscription",
              "payment",
              "donation",
              "vote",
              "booking",
              "license",
              "membership",
              "rental",
              "group"
            ),
            allowNull: false,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          slug: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },
          displayLayout: {
            type: Sequelize.ENUM("mosaic", "list", "icons", "card"),
            defaultValue: "card",
            allowNull: false,
          },
          coverImage: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          shortDescription: {
            type: Sequelize.STRING(140),
            allowNull: true,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          currency: {
            type: Sequelize.STRING(3),
            allowNull: false,
            defaultValue: "RWF",
          },
          taxProfileId: {
            type: Sequelize.UUID,
            allowNull: true,
          },
          pricing: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: { mode: "fixed", amount: 0 },
          },
          availability: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          visibility: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: { mode: "public" },
          },
          buyerFields: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: [],
          },
          fulfillment: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: { storeOnBuyerQR: false },
          },
          policy: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          webhooks: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          customFields: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },
          status: {
            type: Sequelize.ENUM("draft", "published", "archived"),
            defaultValue: "draft",
            allowNull: false,
          },
          dedicatedQrCode: {
            type: Sequelize.TEXT,
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
        },
        { transaction }
      );

      // Add indexes
      await queryInterface.addIndex("Actions", ["organizationId"], {
        name: "idx_actions_organization_id",
        transaction,
      });
      await queryInterface.addIndex("Actions", ["slug"], {
        name: "idx_actions_slug",
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("Actions", ["type"], {
        name: "idx_actions_type",
        transaction,
      });
      await queryInterface.addIndex("Actions", ["status"], {
        name: "idx_actions_status",
        transaction,
      });
      await queryInterface.addIndex("Actions", ["organizationId", "status"], {
        name: "idx_actions_org_status",
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
      await queryInterface.dropTable("Actions", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Actions_type";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Actions_displayLayout";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Actions_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

