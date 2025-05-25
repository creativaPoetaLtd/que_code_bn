'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      picture: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'URL or path to group picture',
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      qrCode: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'QR code for group joining',
      },
      accessLink: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Unique link for group access',
      },
      accessToken: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Token for group access validation',
      },
      isPrivate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether group requires approval to join',
      },
      maxMembers: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 100,
      },
      memberCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Current number of members (including owner)',
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
    await queryInterface.addIndex('Groups', ['ownerId']);
    await queryInterface.addIndex('Groups', ['accessLink'], {
      unique: true,
    });
    await queryInterface.addIndex('Groups', ['accessToken'], {
      unique: true,
    });
    await queryInterface.addIndex('Groups', ['isPrivate']);
    await queryInterface.addIndex('Groups', ['createdAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Groups', ['ownerId']);
    await queryInterface.removeIndex('Groups', ['accessLink']);
    await queryInterface.removeIndex('Groups', ['accessToken']);
    await queryInterface.removeIndex('Groups', ['isPrivate']);
    await queryInterface.removeIndex('Groups', ['createdAt']);
    await queryInterface.dropTable('Groups');
  },
};
