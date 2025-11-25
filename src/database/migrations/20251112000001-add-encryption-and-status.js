"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Helper function to check if table exists
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // Add encryption fields to ChatMessages
    if (!(await columnExists('ChatMessages', 'isEncrypted'))) {
      await queryInterface.addColumn('ChatMessages', 'isEncrypted', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      });
    }

    if (!(await columnExists('ChatMessages', 'encryptionIv'))) {
      await queryInterface.addColumn('ChatMessages', 'encryptionIv', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Create table for chat encryption keys
    if (!(await tableExists('ChatKeys'))) {
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
    }

    // Create table for user encryption keys
    if (!(await tableExists('UserKeys'))) {
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
    }

    // Add message status fields
    if (!(await columnExists('ChatMessages', 'status'))) {
      await queryInterface.addColumn('ChatMessages', 'status', {
        type: Sequelize.ENUM('sent', 'delivered', 'read'),
        defaultValue: 'sent',
        allowNull: false
      });
    }

    if (!(await columnExists('ChatMessages', 'deliveredAt'))) {
      await queryInterface.addColumn('ChatMessages', 'deliveredAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!(await columnExists('ChatMessages', 'readAt'))) {
      await queryInterface.addColumn('ChatMessages', 'readAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Add indexes if they don't exist
    try {
      await queryInterface.addIndex('ChatKeys', ['chatId', 'userId'], {
        name: 'idx_chat_keys_chat_user',
        unique: true
      });
    } catch (e) {
      // Index might already exist, ignore
    }

    try {
      await queryInterface.addIndex('ChatMessages', ['status'], {
        name: 'idx_chat_messages_status'
      });
    } catch (e) {
      // Index might already exist, ignore
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Helper function to check if table exists
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // Remove columns from ChatMessages
    if (await columnExists('ChatMessages', 'isEncrypted')) {
      await queryInterface.removeColumn('ChatMessages', 'isEncrypted');
    }
    if (await columnExists('ChatMessages', 'encryptionIv')) {
      await queryInterface.removeColumn('ChatMessages', 'encryptionIv');
    }
    if (await columnExists('ChatMessages', 'status')) {
      await queryInterface.removeColumn('ChatMessages', 'status');
    }
    if (await columnExists('ChatMessages', 'deliveredAt')) {
      await queryInterface.removeColumn('ChatMessages', 'deliveredAt');
    }
    if (await columnExists('ChatMessages', 'readAt')) {
      await queryInterface.removeColumn('ChatMessages', 'readAt');
    }

    // Drop tables
    if (await tableExists('ChatKeys')) {
      await queryInterface.dropTable('ChatKeys');
    }
    if (await tableExists('UserKeys')) {
      await queryInterface.dropTable('UserKeys');
    }

    // Drop enum
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ChatMessages_status";'
    );
  }
};
