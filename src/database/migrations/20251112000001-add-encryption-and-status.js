"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add encryption fields to ChatMessages
    await queryInterface.addColumn('ChatMessages', 'isEncrypted', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });

    await queryInterface.addColumn('ChatMessages', 'encryptionIv', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Create table for chat encryption keys
    await queryInterface.createTable('ChatKeys', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      chatId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Chats',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      encryptedKey: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create table for user encryption keys
    await queryInterface.createTable('UserKeys', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      publicKey: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      privateKeyEncrypted: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add message status fields
    await queryInterface.addColumn('ChatMessages', 'status', {
      type: Sequelize.ENUM('sent', 'delivered', 'read'),
      defaultValue: 'sent',
      allowNull: false
    });

    await queryInterface.addColumn('ChatMessages', 'deliveredAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('ChatMessages', 'readAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add indexes
    await queryInterface.addIndex('ChatKeys', ['chatId', 'userId'], {
      name: 'idx_chat_keys_chat_user',
      unique: true
    });

    await queryInterface.addIndex('ChatMessages', ['status'], {
      name: 'idx_chat_messages_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns from ChatMessages
    await queryInterface.removeColumn('ChatMessages', 'isEncrypted');
    await queryInterface.removeColumn('ChatMessages', 'encryptionIv');
    await queryInterface.removeColumn('ChatMessages', 'status');
    await queryInterface.removeColumn('ChatMessages', 'deliveredAt');
    await queryInterface.removeColumn('ChatMessages', 'readAt');

    // Drop tables
    await queryInterface.dropTable('ChatKeys');
    await queryInterface.dropTable('UserKeys');

    // Drop enum
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ChatMessages_status";'
    );
  }
};