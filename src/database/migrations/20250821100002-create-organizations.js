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
      // Additional fields that were being added by other migrations
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      services: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      welcomeMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      showWelcomeToNewUsers: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showWelcomeToExistingUsers: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      qrCode: {
        type: Sequelize.TEXT, // Changed from STRING to TEXT for longer QR codes
        allowNull: true,
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: true,
        // Note: Foreign key constraint will be added later after OrganizationCategories table is created
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

    // Add indexes for better performance
    await queryInterface.addIndex("Organizations", ["email"], {
      name: "idx_organizations_email",
      unique: true,
    });

    await queryInterface.addIndex("Organizations", ["categoryId"], {
      name: "idx_organizations_category",
    });

    await queryInterface.addIndex("Organizations", ["approvalStatus"], {
      name: "idx_organizations_approval_status",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Organizations");
  },
};