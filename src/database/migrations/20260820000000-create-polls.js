"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Polls_status') THEN
          CREATE TYPE "enum_Polls_status" AS ENUM ('open', 'closed');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("Polls", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      chatId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Chats", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Groups", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      question: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      options: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      allowMultiple: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isAnonymous: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      closesAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("open", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "ChatMessages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.createTable("PollVotes", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      pollId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Polls", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      optionId: {
        type: Sequelize.STRING,
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

    await queryInterface.addIndex("Polls", ["chatId"], {
      name: "idx_polls_chat_id",
    });
    await queryInterface.addIndex("Polls", ["groupId"], {
      name: "idx_polls_group_id",
    });
    // One row per person per option - a re-vote replaces the previous rows
    await queryInterface.addIndex("PollVotes", ["pollId", "userId", "optionId"], {
      name: "idx_poll_votes_poll_user_option",
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("PollVotes");
    await queryInterface.dropTable("Polls");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Polls_status";');
  },
};
