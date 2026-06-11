'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('Chats');
    if (!tableDesc.type) {
      await queryInterface.addColumn('Chats', 'type', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'dm',
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Chats', 'type');
  },
};
