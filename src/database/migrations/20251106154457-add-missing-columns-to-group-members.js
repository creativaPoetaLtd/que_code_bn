'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Get the current table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('GroupMembers');
    
    // List of columns that should exist based on the model
    const columnsToAdd = [
      {
        name: 'additionalInfo',
        definition: {
          type: Sequelize.TEXT,
          allowNull: true,
        }
      },
      {
        name: 'respondedAt',
        definition: {
          type: Sequelize.DATE,
          allowNull: true,
        }
      },
      {
        name: 'autoApproved',
        definition: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      },
      {
        name: 'approvedBy',
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
        name: 'rejectedBy',
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
        name: 'rejectedAt',
        definition: {
          type: Sequelize.DATE,
          allowNull: true,
        }
      },
      {
        name: 'rejectionReason',
        definition: {
          type: Sequelize.TEXT,
          allowNull: true,
        }
      }
    ];

    // Add each column if it doesn't exist
    for (const column of columnsToAdd) {
      if (!tableDescription[column.name]) {
        console.log(`Adding column ${column.name} to GroupMembers table`);
        await queryInterface.addColumn('GroupMembers', column.name, column.definition);
      } else {
        console.log(`Column ${column.name} already exists in GroupMembers table`);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Get the current table description to check which columns exist
    const tableDescription = await queryInterface.describeTable('GroupMembers');
    
    // List of columns to potentially remove
    const columnsToRemove = [
      'additionalInfo',
      'respondedAt', 
      'autoApproved',
      'approvedBy',
      'rejectedBy',
      'rejectedAt',
      'rejectionReason'
    ];

    // Remove each column if it exists
    for (const columnName of columnsToRemove) {
      if (tableDescription[columnName]) {
        console.log(`Removing column ${columnName} from GroupMembers table`);
        await queryInterface.removeColumn('GroupMembers', columnName);
      }
    }
  }
};
