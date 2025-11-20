'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add PIN reset OTP fields to Users table
    await queryInterface.addColumn('Users', 'pinResetOtp', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'OTP code for PIN reset'
    });

    await queryInterface.addColumn('Users', 'pinResetOtpExpires', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Expiration timestamp for PIN reset OTP'
    });

    console.log('✅ Added pinResetOtp and pinResetOtpExpires columns to Users table');
  },

  async down(queryInterface, Sequelize) {
    // Remove the PIN reset OTP fields
    await queryInterface.removeColumn('Users', 'pinResetOtp');
    await queryInterface.removeColumn('Users', 'pinResetOtpExpires');

    console.log('✅ Removed pinResetOtp and pinResetOtpExpires columns from Users table');
  }
};
