"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ChatMessageRecipientPayloads", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      chatMessageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "ChatMessages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      recipientUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      recipientDeviceId: {
        type: Sequelize.STRING(128),
        allowNull: false,
        references: {
          model: "UserDevices",
          key: "deviceId",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderDeviceId: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      encryptedEnvelope: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("ChatMessageRecipientPayloads", ["chatMessageId"], {
      name: "chat_message_recipient_payloads_message_idx",
    });
    await queryInterface.addIndex(
      "ChatMessageRecipientPayloads",
      ["recipientUserId", "recipientDeviceId"],
      {
        name: "chat_message_recipient_payloads_recipient_idx",
      },
    );
    await queryInterface.addIndex(
      "ChatMessageRecipientPayloads",
      ["chatMessageId", "recipientDeviceId"],
      {
        unique: true,
        name: "chat_message_recipient_payloads_message_device_unique",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_message_device_unique",
    );
    await queryInterface.removeIndex(
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_recipient_idx",
    );
    await queryInterface.removeIndex(
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_message_idx",
    );
    await queryInterface.dropTable("ChatMessageRecipientPayloads");
  },
};
