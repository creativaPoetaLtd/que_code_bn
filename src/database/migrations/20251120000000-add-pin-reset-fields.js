'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Add PIN reset OTP fields to Users table
    if (!(await columnExists('Users', 'pinResetOtp'))) {
      await queryInterface.addColumn('Users', 'pinResetOtp', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'OTP code for PIN reset'
      });
    }

    if (!(await columnExists('Users', 'pinResetOtpExpires'))) {
      await queryInterface.addColumn('Users', 'pinResetOtpExpires', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Expiration timestamp for PIN reset OTP'
      });
    }

    console.log('✅ Added pinResetOtp and pinResetOtpExpires columns to Users table');
  },

  async down(queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Remove the PIN reset OTP fields
    if (await columnExists('Users', 'pinResetOtp')) {
      await queryInterface.removeColumn('Users', 'pinResetOtp');
    }
    if (await columnExists('Users', 'pinResetOtpExpires')) {
      await queryInterface.removeColumn('Users', 'pinResetOtpExpires');
    }

    console.log('✅ Removed pinResetOtp and pinResetOtpExpires columns from Users table');
  }
};
