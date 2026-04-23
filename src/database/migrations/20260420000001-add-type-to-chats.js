'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Chats', 'type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'dm',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Chats', 'type');
  },
};
