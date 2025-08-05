'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop and recreate ENUM type for status
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Contacts_status" CASCADE;
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_Contacts_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
    `);

    // Create the Contacts table
    await queryInterface.createTable('Contacts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      inviterId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      inviteeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'PENDING',
        allowNull: false
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      invitationToken: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Token for email-based invitation responses"
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add the unique composite index
    await queryInterface.addIndex('Contacts', ['inviterId', 'inviteeId'], {
      unique: true,
      name: 'unique_inviter_invitee'
    });

    // Add index on invitationToken
    await queryInterface.addIndex('Contacts', ['invitationToken'], {
      name: 'contacts_invitation_token_index'
    });

    // Add index on status
    await queryInterface.addIndex('Contacts', ['status'], {
      name: 'contacts_status_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Contacts');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Contacts_status";
    `);
  }
};
