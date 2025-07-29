'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'profileImage', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'statusMessage', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'showPhoneOnWelcome', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('Users', 'showProfileImageOnWelcome', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('Users', 'showStatusMessageOnWelcome', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'profileImage');
    await queryInterface.removeColumn('Users', 'statusMessage');
    await queryInterface.removeColumn('Users', 'showPhoneOnWelcome');
    await queryInterface.removeColumn('Users', 'showProfileImageOnWelcome');
    await queryInterface.removeColumn('Users', 'showStatusMessageOnWelcome');
  }
};