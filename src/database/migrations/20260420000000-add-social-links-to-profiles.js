"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("Profiles")) {
      return;
    }

    const table = await queryInterface.describeTable("Profiles");

    if (!table.instagram) {
      await queryInterface.addColumn("Profiles", "instagram", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.facebook) {
      await queryInterface.addColumn("Profiles", "facebook", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.twitter) {
      await queryInterface.addColumn("Profiles", "twitter", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.linkedin) {
      await queryInterface.addColumn("Profiles", "linkedin", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("Profiles")) {
      return;
    }

    const table = await queryInterface.describeTable("Profiles");

    if (table.instagram) {
      await queryInterface.removeColumn("Profiles", "instagram");
    }

    if (table.facebook) {
      await queryInterface.removeColumn("Profiles", "facebook");
    }

    if (table.twitter) {
      await queryInterface.removeColumn("Profiles", "twitter");
    }

    if (table.linkedin) {
      await queryInterface.removeColumn("Profiles", "linkedin");
    }
  },
};
