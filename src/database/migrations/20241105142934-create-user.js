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
      firstName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      gender: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false
      },
      province: {
        type: Sequelize.STRING,
        allowNull: true
      },
      district: {
        type: Sequelize.STRING,
        allowNull: true
      },
      sector: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cell: {
        type: Sequelize.STRING,
        allowNull: true
      },
      logo: {
        type: Sequelize.STRING,
        allowNull: true
      },
      national_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      resetToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      resetTokenExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      otp: {
        type: Sequelize.STRING,
        allowNull: true
      },
      otpExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastOtpSent: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      qrCode: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      profileImage: {
        type: Sequelize.STRING,
        allowNull: true
      },
      statusMessage: {
        type: Sequelize.STRING,
        allowNull: true
      },
      showPhoneOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      showProfileImageOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      showStatusMessageOnWelcome: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      publicId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      profileLink: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};
