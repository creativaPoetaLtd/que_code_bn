"use strict";

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === "string" ? table : table.tableName || table.name;
    return name === tableName;
  });
};

const indexExists = async (queryInterface, tableName, indexName) => {
  if (!(await tableExists(queryInterface, tableName))) {
    return false;
  }
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
};

const addIndexIfMissing = async (queryInterface, tableName, fields, options) => {
  if (!(await indexExists(queryInterface, tableName, options.name))) {
    await queryInterface.addIndex(tableName, fields, options);
  }
};

const removeIndexIfExists = async (queryInterface, tableName, indexName) => {
  if (await indexExists(queryInterface, tableName, indexName)) {
    await queryInterface.removeIndex(tableName, indexName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "ChatMessageRecipientPayloads"))) {
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
    }

    await addIndexIfMissing(queryInterface, "ChatMessageRecipientPayloads", ["chatMessageId"], {
      name: "chat_message_recipient_payloads_message_idx",
    });
    await addIndexIfMissing(
      queryInterface,
      "ChatMessageRecipientPayloads",
      ["recipientUserId", "recipientDeviceId"],
      {
        name: "chat_message_recipient_payloads_recipient_idx",
      },
    );
    await addIndexIfMissing(
      queryInterface,
      "ChatMessageRecipientPayloads",
      ["chatMessageId", "recipientDeviceId"],
      {
        unique: true,
        name: "chat_message_recipient_payloads_message_device_unique",
      },
    );
  },

  async down(queryInterface) {
    await removeIndexIfExists(
      queryInterface,
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_message_device_unique",
    );
    await removeIndexIfExists(
      queryInterface,
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_recipient_idx",
    );
    await removeIndexIfExists(
      queryInterface,
      "ChatMessageRecipientPayloads",
      "chat_message_recipient_payloads_message_idx",
    );
    if (await tableExists(queryInterface, "ChatMessageRecipientPayloads")) {
      await queryInterface.dropTable("ChatMessageRecipientPayloads");
    }
  },
};

