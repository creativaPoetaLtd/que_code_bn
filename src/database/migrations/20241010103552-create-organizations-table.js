"use strict";

const { UUIDV4 } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("organizations1", {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            ownerPhone: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            ownerEmail: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            contactPhone: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            tinNumber: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            registrationNumber: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            province: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            district: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            sector: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            cell: {
                type: Sequelize.STRING,
                allowNull: false,
            },

            logo: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            operationalDocument: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            apporvalStatus: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,

            },


        });
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("organizations1");
    },
};