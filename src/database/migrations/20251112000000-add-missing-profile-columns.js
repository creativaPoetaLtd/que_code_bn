"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if Profiles table exists before trying to add columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Profiles')) {
      // Check if columns already exist before adding them
      const table = await queryInterface.describeTable('Profiles');
      
      if (!table.showProfileTypeOnWelcome) {
        await queryInterface.addColumn('Profiles', 'showProfileTypeOnWelcome', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false
        });
      }

      if (!table.showLocationOnWelcome) {
        await queryInterface.addColumn('Profiles', 'showLocationOnWelcome', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false
        });
      }

      if (!table.showTinOnWelcome) {
        await queryInterface.addColumn('Profiles', 'showTinOnWelcome', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false
        });
      }

      if (!table.showLogoOnWelcome) {
        await queryInterface.addColumn('Profiles', 'showLogoOnWelcome', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if Profiles table exists before trying to remove columns
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Profiles')) {
      await queryInterface.removeColumn('Profiles', 'showProfileTypeOnWelcome');
      await queryInterface.removeColumn('Profiles', 'showLocationOnWelcome');
      await queryInterface.removeColumn('Profiles', 'showTinOnWelcome');
      await queryInterface.removeColumn('Profiles', 'showLogoOnWelcome');
    }
  }
};