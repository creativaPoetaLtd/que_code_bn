'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Get the current table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('Groups');
    
    // List of columns that should exist based on the model
    const columnsToAdd = [
      {
        name: 'adminId',
        definition: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }
      },
      {
        name: 'accessToken',
        definition: {
          type: Sequelize.STRING,
          allowNull: true,
        }
      },
      {
        name: 'privacyType',
        definition: {
          type: Sequelize.ENUM('private', 'public', 'require_approval'),
          defaultValue: 'require_approval',
        }
      },
      {
        name: 'maxMembers',
        definition: {
          type: Sequelize.INTEGER,
          allowNull: true,
        }
      },
      {
        name: 'memberCount',
        definition: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        }
      },
      {
        name: 'hasFundraising',
        definition: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      },
      {
        name: 'fundraisingTarget',
        definition: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true,
        }
      },
      {
        name: 'fundraisingCurrentAmount',
        definition: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0.00,
        }
      },
      {
        name: 'expirationDate',
        definition: {
          type: Sequelize.DATE,
          allowNull: true,
        }
      },
      {
        name: 'expirationType',
        definition: {
          type: Sequelize.ENUM('custom_date', 'target_reached', 'deadline_reached', 'never'),
          defaultValue: 'never',
        }
      },
      {
        name: 'hasAdditionalInfo',
        definition: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      },
      {
        name: 'additionalInfoPrompt',
        definition: {
          type: Sequelize.TEXT,
          allowNull: true,
        }
      },
      {
        name: 'profilePictureUrl',
        definition: {
          type: Sequelize.STRING,
          allowNull: true,
        }
      },
      {
        name: 'profilePicturePublicId',
        definition: {
          type: Sequelize.STRING,
          allowNull: true,
        }
      },
      {
        name: 'walletId',
        definition: {
          type: Sequelize.UUID,
          allowNull: true,
        }
      },
      {
        name: 'lifeTime',
        definition: {
          type: Sequelize.INTEGER,
          allowNull: true,
        }
      }
    ];

    // Add each column if it doesn't exist
    for (const column of columnsToAdd) {
      if (!tableDescription[column.name]) {
        console.log(`Adding column ${column.name} to Groups table`);
        await queryInterface.addColumn('Groups', column.name, column.definition);
      } else {
        console.log(`Column ${column.name} already exists in Groups table`);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Get the current table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('Groups');
    
    // List of columns to potentially remove
    const columnsToRemove = [
      'adminId',
      'accessToken',
      'privacyType',
      'maxMembers',
      'memberCount',
      'hasFundraising',
      'fundraisingTarget',
      'fundraisingCurrentAmount',
      'expirationDate',
      'expirationType',
      'hasAdditionalInfo',
      'additionalInfoPrompt',
      'profilePictureUrl',
      'profilePicturePublicId',
      'walletId',
      'lifeTime'
    ];

    // Remove each column if it exists
    for (const columnName of columnsToRemove) {
      if (tableDescription[columnName]) {
        console.log(`Removing column ${columnName} from Groups table`);
        await queryInterface.removeColumn('Groups', columnName);
      }
    }
  }
};
