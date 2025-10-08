"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop all tables in reverse dependency order
      const tables = [
        'UserRoles',
        'RolePermissions', 
        'Roles',
        'Permissions',
        'Notifications',
        'ChatMessages',
        'ChatParticipants',
        'Chats',
        'GroupMembers',
        'Groups',
        'ContactInvitations',
        'Contacts',
        'ExternalAccounts',
        'Payments',
        'WalletRestrictions',
        'Transactions',
        'Wallets',
        'Profiles',
        'Organizations',
        'Categories',
        'Users'
      ];

      for (const table of tables) {
        try {
          await queryInterface.dropTable(table, { transaction });
          console.log(`✅ Dropped table: ${table}`);
        } catch (error) {
          console.log(`ℹ️ Table ${table} may not exist or already dropped`);
        }
      }

      await transaction.commit();
      console.log("✅ Database reset completed successfully");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // This migration cannot be rolled back as it drops all data
    console.log("⚠️ This migration cannot be rolled back - all data will be lost");
  }
};
