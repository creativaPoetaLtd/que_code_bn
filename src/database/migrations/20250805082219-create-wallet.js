'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'RWF',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex('wallets', ['userId'], {
      unique: true,
      name: 'wallets_userId_unique'
    });

    await queryInterface.addIndex('wallets', ['isActive'], {
      name: 'wallets_isActive_index'
    });

    // Add constraints
    await queryInterface.addConstraint('wallets', {
      fields: ['balance'],
      type: 'check',
      name: 'wallets_balance_positive',
      where: {
        balance: {
          [Sequelize.Op.gte]: 0
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove constraints first
    await queryInterface.removeConstraint('wallets', 'wallets_balance_positive');

    // Remove indexes
    await queryInterface.removeIndex('wallets', 'wallets_userId_unique');
    await queryInterface.removeIndex('wallets', 'wallets_isActive_index');

    // Drop the table
    await queryInterface.dropTable('wallets');
  }
};