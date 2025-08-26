"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ContactInvitations_status') THEN
          CREATE TYPE "enum_ContactInvitations_status" AS ENUM ('pending', 'accepted', 'declined', 'expired');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("ContactInvitations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      inviterId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      inviteeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("pending", "accepted", "declined", "expired"),
        defaultValue: "pending",
        allowNull: false,
      },
      invitationToken: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      invitedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex("ContactInvitations", ["inviterId"], {
      name: "idx_contact_invitations_inviter_id",
    });
    await queryInterface.addIndex("ContactInvitations", ["inviteeId"], {
      name: "idx_contact_invitations_invitee_id",
    });
    await queryInterface.addIndex("ContactInvitations", ["invitationToken"], {
      name: "idx_contact_invitations_token",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("ContactInvitations");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ContactInvitations_status";'
    );
  },
};
