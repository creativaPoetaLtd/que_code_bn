"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First check if the enum type already exists
    const enumExists = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_Contacts_status'
      );
    `, { type: queryInterface.sequelize.QueryTypes.SELECT });

    // Only create the enum if it doesn't exist
    if (!enumExists[0].exists) {
      await queryInterface.sequelize.query(
        'CREATE TYPE "enum_Contacts_status" AS ENUM(\'active\', \'blocked\');'
      );
    }

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

    // Add indexes for better query performance
    await queryInterface.addIndex("Contacts", ["userAId"], {
      name: "idx_contacts_user_a_id",
    });

    await queryInterface.addIndex("Contacts", ["userBId"], {
      name: "idx_contacts_user_b_id",
    });

    await queryInterface.addIndex("Contacts", ["status"], {
      name: "idx_contacts_status",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Contacts");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Contacts_status";'
    );
  },
};