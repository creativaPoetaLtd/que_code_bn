"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("Profiles")) {
      return;
    }

    const table = await queryInterface.describeTable("Profiles");

    const columns = [
      "showCategoryOnWelcome",
      "showSocialLinksOnWelcome",
      "showGalleryOnWelcome",
      "showOrgStatsOnWelcome",
      "showActionsOnWelcome",
      "showSendMoneyOnWelcome",
      "showContactFormOnWelcome",
      "showOtherInfoOnWelcome",
      "showFriendRequestOnWelcome",
    ];

    for (const column of columns) {
      if (!table[column]) {
        await queryInterface.addColumn("Profiles", column, {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        });
      }
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("Profiles")) {
      return;
    }

    const table = await queryInterface.describeTable("Profiles");

    const columns = [
      "showCategoryOnWelcome",
      "showSocialLinksOnWelcome",
      "showGalleryOnWelcome",
      "showOrgStatsOnWelcome",
      "showActionsOnWelcome",
      "showSendMoneyOnWelcome",
      "showContactFormOnWelcome",
      "showOtherInfoOnWelcome",
      "showFriendRequestOnWelcome",
    ];

    for (const column of columns) {
      if (table[column]) {
        await queryInterface.removeColumn("Profiles", column);
      }
    }
  },
};
