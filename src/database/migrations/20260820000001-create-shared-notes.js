"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("SharedNotes", {
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
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      lastEditedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      lastEditedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("SharedNotes", ["chatId"], {
      name: "idx_shared_notes_chat_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("SharedNotes");
  },
};
