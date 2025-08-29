"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum types
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_GroupMembers_role') THEN
          CREATE TYPE "enum_GroupMembers_role" AS ENUM ('owner', 'admin', 'member');
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_GroupMembers_status') THEN
          CREATE TYPE "enum_GroupMembers_status" AS ENUM ('pending', 'active', 'left', 'removed');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("GroupMembers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      role: {
        type: Sequelize.ENUM("owner", "admin", "member"),
        defaultValue: "member",
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "active", "left", "removed"),
        defaultValue: "pending",
        allowNull: false,
      },
      invitedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      joinedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      respondedAt: {
        type: Sequelize.DATE,
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
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "idx_group_members_group_id" ON "GroupMembers" ("groupId");');
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "idx_group_members_user_id" ON "GroupMembers" ("userId");');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_group_members_group_user" ON "GroupMembers" ("groupId", "userId");');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("GroupMembers");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_GroupMembers_role";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_GroupMembers_status";'
    );
  },
};
