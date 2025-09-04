'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Profiles', 'showProfileTypeOnWelcome', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    await queryInterface.addColumn('Profiles', 'showLocationOnWelcome', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    await queryInterface.addColumn('Profiles', 'showTinOnWelcome', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    await queryInterface.addColumn('Profiles', 'showLogoOnWelcome', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Profiles', 'showProfileTypeOnWelcome');
    await queryInterface.removeColumn('Profiles', 'showLocationOnWelcome');
    await queryInterface.removeColumn('Profiles', 'showTinOnWelcome');
    await queryInterface.removeColumn('Profiles', 'showLogoOnWelcome');
  }
}; 