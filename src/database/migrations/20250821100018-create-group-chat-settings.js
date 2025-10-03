"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("GroupChatSettings", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "Groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      canMembersInvite: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      canMembersDeleteMessages: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      onlyAdminsCanPost: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      messageRetentionDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      allowFileSharing: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      allowMoneyTransfers: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      maxFileSize: {
        type: Sequelize.INTEGER,
        defaultValue: 10485760, // 10MB
        allowNull: true,
      },
      allowedFileTypes: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify(["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "txt", "mp4", "mp3"]),
        allowNull: true,
      },
      profanityFilter: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      linkPreview: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      readReceipts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      typingIndicators: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      slowMode: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      announcementMode: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    // Add indexes
    await queryInterface.addIndex("GroupChatSettings", ["groupId"], {
      unique: true,
      name: "idx_group_chat_settings_group_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("GroupChatSettings");
  },
};