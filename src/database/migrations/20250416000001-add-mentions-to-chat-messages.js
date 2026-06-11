"use strict";

/**
 * Adds a `mentions` JSONB column to ChatMessages.
 * Stores an array of { userId, username } objects for @-mentioned users.
 * Nullable so existing rows are unaffected.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("ChatMessages");
    if (!tableDesc.mentions) {
      await queryInterface.addColumn("ChatMessages", "mentions", {
        type:         Sequelize.JSONB,
        allowNull:    true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ChatMessages", "mentions");
  },
};
