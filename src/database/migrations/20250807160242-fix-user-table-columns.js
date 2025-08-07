'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove the old approvalStatus column
    await queryInterface.removeColumn('Users', 'approvalStatus');

    // Add approvalStatus as BOOLEAN
    await queryInterface.addColumn('Users', 'approvalStatus', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add missing columns
    await queryInterface.addColumn('Users', 'publicId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'profileLink', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove approvalStatus column
    await queryInterface.removeColumn('Users', 'approvalStatus');

    // Add approvalStatus back as VARCHAR
    await queryInterface.addColumn('Users', 'approvalStatus', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Remove added columns
    await queryInterface.removeColumn('Users', 'publicId');
    await queryInterface.removeColumn('Users', 'profileLink');
  }
};
