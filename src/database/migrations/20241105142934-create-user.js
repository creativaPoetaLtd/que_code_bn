'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      firstName: { type: Sequelize.STRING },
      lastName: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      password: { type: Sequelize.STRING },
      gender: { type: Sequelize.STRING },
      phone: { type: Sequelize.STRING },
      province: { type: Sequelize.STRING },
      district: { type: Sequelize.STRING },
      sector: { type: Sequelize.STRING },
      national_id: { type: Sequelize.STRING },
      resetTokenExpires: { type: Sequelize.DATE },
      resetToken: { type: Sequelize.STRING },
      isVerified: { type: Sequelize.BOOLEAN },
      lastOtpSent: { type: Sequelize.DATE },
      otp: { type: Sequelize.STRING },
      qrCode: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      otpExpires: { type: Sequelize.DATE },
      profileImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      statusMessage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      showPhoneOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      showProfileImageOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      showStatusMessageOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users', {
      cascade: true
    });
  }
};
