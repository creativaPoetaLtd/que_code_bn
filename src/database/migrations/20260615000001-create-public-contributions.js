"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("PublicContributions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      walletId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Wallets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      title: { type: Sequelize.STRING, allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      goalAmount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      type: {
        type: Sequelize.ENUM("fixed", "flexible"),
        allowNull: false,
      },
      amountPerMember: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      minimumAmount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      deadline: { type: Sequelize.DATE, allowNull: true },
      disbursementPolicy: {
        type: Sequelize.ENUM("hold", "auto"),
        allowNull: false,
        defaultValue: "hold",
      },
      status: {
        type: Sequelize.ENUM("active", "completed", "closed", "expired"),
        allowNull: false,
        defaultValue: "active",
      },
      visibilityMode: {
        type: Sequelize.ENUM("all", "creator_only"),
        allowNull: false,
        defaultValue: "all",
      },
      currency: { type: Sequelize.STRING, defaultValue: "RWF" },
      collectedAmount: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      contributorCount: { type: Sequelize.INTEGER, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("PublicContributionPayments", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      contributionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "PublicContributions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      payerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      transactionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Transactions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      currency: { type: Sequelize.STRING, defaultValue: "RWF" },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("PublicContributionPayments");
    await queryInterface.dropTable("PublicContributions");
  },
};
