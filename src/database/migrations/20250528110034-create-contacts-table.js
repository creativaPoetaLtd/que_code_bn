'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table already exists
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Contacts'
      );`
    );

    if (tableExists[0][0].exists) {
      console.log('Contacts table already exists - skipping creation');
      return;
    }

    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Contacts_status') THEN
          CREATE TYPE "enum_Contacts_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
        END IF;
      END
      $$;
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



    // Safe index creation
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'unique_inviter_invitee'
        ) THEN
          CREATE UNIQUE INDEX unique_inviter_invitee
          ON "Contacts" ("inviterId", "inviteeId");
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'contacts_invitation_token_index'
        ) THEN
          CREATE INDEX contacts_invitation_token_index
          ON "Contacts" ("invitationToken");
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'contacts_status_index'
        ) THEN
          CREATE INDEX contacts_status_index
          ON "Contacts" ("status");
        END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('Contacts', 'unique_inviter_invitee');
    await queryInterface.removeIndex('Contacts', 'contacts_invitation_token_index');
    await queryInterface.removeIndex('Contacts', 'contacts_status_index');

    // Drop table
    await queryInterface.dropTable('Contacts');

    // Drop enum
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Contacts_status";
    `);
  }
};
