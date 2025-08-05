'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      transactionId: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      receiverId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'RWF',
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      type: {
        type: Sequelize.ENUM('transfer', 'deposit', 'withdrawal'),
        allowNull: false,
        defaultValue: 'transfer',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      processedAt: {
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
    await queryInterface.addIndex('transactions', ['transactionId'], {
      unique: true,
      name: 'transactions_transactionId_unique'
    });

    await queryInterface.addIndex('transactions', ['senderId'], {
      name: 'transactions_senderId_index'
    });

    await queryInterface.addIndex('transactions', ['receiverId'], {
      name: 'transactions_receiverId_index'
    });

    await queryInterface.addIndex('transactions', ['status'], {
      name: 'transactions_status_index'
    });

    await queryInterface.addIndex('transactions', ['type'], {
      name: 'transactions_type_index'
    });

    await queryInterface.addIndex('transactions', ['createdAt'], {
      name: 'transactions_createdAt_index'
    });

    await queryInterface.addIndex('transactions', ['senderId', 'receiverId'], {
      name: 'transactions_senderId_receiverId_index'
    });

    // Add constraints
    await queryInterface.addConstraint('transactions', {
      fields: ['amount'],
      type: 'check',
      name: 'transactions_amount_positive',
      where: {
        amount: {
          [Sequelize.Op.gte]: 0.01
        }
      }
    });

    await queryInterface.addConstraint('transactions', {
      fields: ['fee'],
      type: 'check',
      name: 'transactions_fee_positive',
      where: {
        fee: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('transactions', {
      fields: ['totalAmount'],
      type: 'check',
      name: 'transactions_totalAmount_positive',
      where: {
        totalAmount: {
          [Sequelize.Op.gte]: 0.01
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove constraints first
    await queryInterface.removeConstraint('transactions', 'transactions_amount_positive');
    await queryInterface.removeConstraint('transactions', 'transactions_fee_positive');
    await queryInterface.removeConstraint('transactions', 'transactions_totalAmount_positive');

    // Remove indexes
    await queryInterface.removeIndex('transactions', 'transactions_transactionId_unique');
    await queryInterface.removeIndex('transactions', 'transactions_senderId_index');
    await queryInterface.removeIndex('transactions', 'transactions_receiverId_index');
    await queryInterface.removeIndex('transactions', 'transactions_status_index');
    await queryInterface.removeIndex('transactions', 'transactions_type_index');
    await queryInterface.removeIndex('transactions', 'transactions_createdAt_index');
    await queryInterface.removeIndex('transactions', 'transactions_senderId_receiverId_index');

    // Drop the table
    await queryInterface.dropTable('transactions');
  }
};