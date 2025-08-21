"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ChatMessages_messageType') THEN
          CREATE TYPE "enum_ChatMessages_messageType" AS ENUM ('text', 'image', 'file', 'money');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("ChatMessages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      chatId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Chats",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      messageType: {
        type: Sequelize.ENUM("text", "image", "file", "money"),
        allowNull: false,
      },
      transactionId: {
        type: Sequelize.UUID,
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

    // Add indexes
    await queryInterface.addIndex("ChatMessages", ["chatId"], {
      name: "idx_chat_messages_chat_id",
    });
    await queryInterface.addIndex("ChatMessages", ["senderId"], {
      name: "idx_chat_messages_sender_id",
    });
    await queryInterface.addIndex("ChatMessages", ["transactionId"], {
      name: "idx_chat_messages_transaction_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("ChatMessages");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ChatMessages_messageType";'
    );
  },
};
