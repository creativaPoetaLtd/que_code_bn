'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GroupMembers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Groups',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('owner', 'admin', 'member'),
        allowNull: false,
        defaultValue: 'member',
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected', 'left', 'removed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      invitedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        comment: 'ID of user who invited this member',
      },
      joinedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the user actually joined (accepted invitation)',
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the user responded to invitation',
      },
      invitationToken: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Token for email-based group invitation responses',
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

    // Indexes
    await queryInterface.addIndex('GroupMembers', ['groupId', 'userId'], {
      unique: true,
      name: 'unique_group_user',
    });

    await queryInterface.addIndex('GroupMembers', ['groupId']);
    await queryInterface.addIndex('GroupMembers', ['userId']);
    await queryInterface.addIndex('GroupMembers', ['status']);
    await queryInterface.addIndex('GroupMembers', ['role']);
    await queryInterface.addIndex('GroupMembers', ['invitedBy']);
    await queryInterface.addIndex('GroupMembers', ['invitationToken']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('GroupMembers', 'unique_group_user');
    await queryInterface.removeIndex('GroupMembers', ['groupId']);
    await queryInterface.removeIndex('GroupMembers', ['userId']);
    await queryInterface.removeIndex('GroupMembers', ['status']);
    await queryInterface.removeIndex('GroupMembers', ['role']);
    await queryInterface.removeIndex('GroupMembers', ['invitedBy']);
    await queryInterface.removeIndex('GroupMembers', ['invitationToken']);
    await queryInterface.dropTable('GroupMembers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_status";');
  }
};
