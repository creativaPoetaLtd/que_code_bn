'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('Contacts');

    if (!tableDescription.userAIsFavorite) {
      await queryInterface.addColumn('Contacts', 'userAIsFavorite', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    if (!tableDescription.userBIsFavorite) {
      await queryInterface.addColumn('Contacts', 'userBIsFavorite', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    if (!tableDescription.userATags) {
      await queryInterface.addColumn('Contacts', 'userATags', {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false
      });
    }

    if (!tableDescription.userBTags) {
      await queryInterface.addColumn('Contacts', 'userBTags', {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('Contacts');

    if (tableDescription.userATags) {
      await queryInterface.removeColumn('Contacts', 'userATags');
    }

    if (tableDescription.userBTags) {
      await queryInterface.removeColumn('Contacts', 'userBTags');
    }

    if (tableDescription.userAIsFavorite) {
      await queryInterface.removeColumn('Contacts', 'userAIsFavorite');
    }

    if (tableDescription.userBIsFavorite) {
      await queryInterface.removeColumn('Contacts', 'userBIsFavorite');
    }
  }
};
