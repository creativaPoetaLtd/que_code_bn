'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Contacts', 'userAIsFavorite', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    await queryInterface.addColumn('Contacts', 'userBIsFavorite', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('Contacts', 'userATags', {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: false
    });
    await queryInterface.addColumn('Contacts', 'userBTags', {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Contacts', 'userATags');
    await queryInterface.removeColumn('Contacts', 'userBTags');
    await queryInterface.removeColumn('Contacts', 'userAIsFavorite');
    await queryInterface.removeColumn('Contacts', 'userBIsFavorite');
  }
};
