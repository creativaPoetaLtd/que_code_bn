"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Contacts_status') THEN
          CREATE TYPE "enum_Contacts_status" AS ENUM ('active', 'blocked');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("Contacts", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userAId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userBId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("active", "blocked"),
        defaultValue: "active",
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

    // Index creation removed to avoid column case issues during migration. Add later if needed.
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Contacts");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Contacts_status";'
    );
  },
};
