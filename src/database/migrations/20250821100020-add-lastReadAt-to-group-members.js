"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable("GroupMembers");
      
      if (!tableDescription.lastReadAt) {
        // Add lastReadAt column to GroupMembers table
        await queryInterface.addColumn("GroupMembers", "lastReadAt", {
          type: Sequelize.DATE,
          allowNull: true,
        });
        console.log("✅ Added lastReadAt column to GroupMembers");
      } else {
        console.log("ℹ️ lastReadAt column already exists in GroupMembers");
      }

      // Check if index already exists
      const indexes = await queryInterface.showIndex("GroupMembers");
      const indexExists = indexes.some(index => index.name === "idx_group_members_last_read_at");
      
      if (!indexExists) {
        // Add index for better performance
        await queryInterface.addIndex("GroupMembers", ["lastReadAt"], {
          name: "idx_group_members_last_read_at",
        });
        console.log("✅ Added index for lastReadAt column");
      } else {
        console.log("ℹ️ Index idx_group_members_last_read_at already exists");
      }

    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Check if index exists before removing
      const indexes = await queryInterface.showIndex("GroupMembers");
      const indexExists = indexes.some(index => index.name === "idx_group_members_last_read_at");
      
      if (indexExists) {
        // Remove index
        await queryInterface.removeIndex("GroupMembers", "idx_group_members_last_read_at");
        console.log("✅ Removed index idx_group_members_last_read_at");
      } else {
        console.log("ℹ️ Index idx_group_members_last_read_at does not exist");
      }

      // Check if column exists before removing
      const tableDescription = await queryInterface.describeTable("GroupMembers");
      
      if (tableDescription.lastReadAt) {
        // Remove column
        await queryInterface.removeColumn("GroupMembers", "lastReadAt");
        console.log("✅ Removed lastReadAt column from GroupMembers");
      } else {
        console.log("ℹ️ lastReadAt column does not exist in GroupMembers");
      }
    } catch (error) {
      console.error("Migration rollback failed:", error);
      throw error;
    }
  },
};