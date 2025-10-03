"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add new columns to ChatMessages table for enhanced group chat functionality
      await queryInterface.addColumn("ChatMessages", "metadata", {
        type: Sequelize.JSON,
        allowNull: true,
      });

      await queryInterface.addColumn("ChatMessages", "replyToMessageId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "ChatMessages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });

      await queryInterface.addColumn("ChatMessages", "isEdited", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });

      await queryInterface.addColumn("ChatMessages", "editedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });

      await queryInterface.addColumn("ChatMessages", "deletedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });

      await queryInterface.addColumn("ChatMessages", "readBy", {
        type: Sequelize.JSON,
        defaultValue: "[]",
        allowNull: true,
      });

      // Update the messageType enum to include new types
      await queryInterface.changeColumn("ChatMessages", "messageType", {
        type: Sequelize.ENUM("text", "image", "file", "money", "system", "announcement"),
        allowNull: false,
        defaultValue: "text",
      });

      // Add indexes for better performance
      await queryInterface.addIndex("ChatMessages", ["replyToMessageId"], {
        name: "idx_chat_messages_reply_to",
      });

      await queryInterface.addIndex("ChatMessages", ["chatId", "createdAt"], {
        name: "idx_chat_messages_chat_created",
      });

      await queryInterface.addIndex("ChatMessages", ["senderId"], {
        name: "idx_chat_messages_sender",
      });

    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove indexes
      await queryInterface.removeIndex("ChatMessages", "idx_chat_messages_reply_to");
      await queryInterface.removeIndex("ChatMessages", "idx_chat_messages_chat_created");
      await queryInterface.removeIndex("ChatMessages", "idx_chat_messages_sender");

      // Remove columns
      await queryInterface.removeColumn("ChatMessages", "metadata");
      await queryInterface.removeColumn("ChatMessages", "replyToMessageId");
      await queryInterface.removeColumn("ChatMessages", "isEdited");
      await queryInterface.removeColumn("ChatMessages", "editedAt");
      await queryInterface.removeColumn("ChatMessages", "deletedAt");
      await queryInterface.removeColumn("ChatMessages", "readBy");

      // Revert messageType enum
      await queryInterface.changeColumn("ChatMessages", "messageType", {
        type: Sequelize.ENUM("text", "image", "file", "money"),
        allowNull: false,
      });
    } catch (error) {
      console.error("Migration rollback failed:", error);
      throw error;
    }
  },
};