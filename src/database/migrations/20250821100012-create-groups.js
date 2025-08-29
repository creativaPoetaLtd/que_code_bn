"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Groups", {
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
      picture: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      qrCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      accessLink: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      accessToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isPrivate: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      maxMembers: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      memberCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      walletId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      lifeTime: {
        type: Sequelize.INTEGER,
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

    // Add indexes (guard with IF NOT EXISTS)
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "idx_groups_owner_id" ON "Groups" ("ownerId");');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "idx_groups_access_link" ON "Groups" ("accessLink");');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "idx_groups_access_token" ON "Groups" ("accessToken");');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Groups");
  },
};
