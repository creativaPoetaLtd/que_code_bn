"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Organizations", {
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
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      ownerName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ownerPhone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ownerEmail: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contactPhone: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      tinNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      approvalStatus: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      categoryId: {
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
    });

    await queryInterface.addIndex("Organizations", ["email"], {
      name: "idx_organizations_email",
      unique: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Organizations");
  },
};
