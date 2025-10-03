"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("GroupMembers", "lastReadAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add index for better performance on read tracking queries
    await queryInterface.addIndex("GroupMembers", ["groupId", "lastReadAt"], {
      name: "idx_group_members_last_read",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("GroupMembers", "idx_group_members_last_read");
    await queryInterface.removeColumn("GroupMembers", "lastReadAt");
  },
};