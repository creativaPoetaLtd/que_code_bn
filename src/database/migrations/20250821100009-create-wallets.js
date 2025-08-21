"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Wallets", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: "RWF",
        allowNull: false,
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

    // Add indexes
    await queryInterface.addIndex("Wallets", ["userId"], {
      name: "idx_wallets_user_id",
    });
    await queryInterface.addIndex("Wallets", ["organizationId"], {
      name: "idx_wallets_organization_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Wallets");
  },
};
