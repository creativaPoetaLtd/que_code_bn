'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
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
      linkId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      usageCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxUsage: {
        type: Sequelize.INTEGER,
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
    await queryInterface.addIndex('payments', ['linkId'], {
      unique: true,
      name: 'payments_linkId_unique'
    });

    await queryInterface.addIndex('payments', ['userId'], {
      name: 'payments_userId_index'
    });

    await queryInterface.addIndex('payments', ['isActive'], {
      name: 'payments_isActive_index'
    });

    await queryInterface.addIndex('payments', ['expiresAt'], {
      name: 'payments_expiresAt_index'
    });

    await queryInterface.addIndex('payments', ['userId', 'isActive'], {
      name: 'payments_userId_isActive_index'
    });

    // Add constraints
    await queryInterface.addConstraint('payments', {
      fields: ['amount'],
      type: 'check',
      name: 'payments_amount_positive',
      where: {
        amount: {
          [Sequelize.Op.gte]: 0.01
        }
      }
    });

    await queryInterface.addConstraint('payments', {
      fields: ['usageCount'],
      type: 'check',
      name: 'payments_usageCount_positive',
      where: {
        usageCount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('payments', {
      fields: ['maxUsage'],
      type: 'check',
      name: 'payments_maxUsage_positive',
      where: {
        maxUsage: {
          [Sequelize.Op.gte]: 1
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove constraints first
    await queryInterface.removeConstraint('payments', 'payments_amount_positive');
    await queryInterface.removeConstraint('payments', 'payments_usageCount_positive');
    await queryInterface.removeConstraint('payments', 'payments_maxUsage_positive');

    // Remove indexes
    await queryInterface.removeIndex('payments', 'payments_linkId_unique');
    await queryInterface.removeIndex('payments', 'payments_userId_index');
    await queryInterface.removeIndex('payments', 'payments_isActive_index');
    await queryInterface.removeIndex('payments', 'payments_expiresAt_index');
    await queryInterface.removeIndex('payments', 'payments_userId_isActive_index');

    // Drop the table
    await queryInterface.dropTable('payments');
  }
};