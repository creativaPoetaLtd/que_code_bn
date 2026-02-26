"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const permissions = [
      // User Management
      {
        id: "01111111-1111-1111-1111-111111111111",
        name: "view_users",
        description: "View all users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "01111111-1111-1111-1111-111111111112",
        name: "create_users",
        description: "Create new users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "01111111-1111-1111-1111-111111111113",
        name: "edit_users",
        description: "Edit user details",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "01111111-1111-1111-1111-111111111114",
        name: "delete_users",
        description: "Delete users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "01111111-1111-1111-1111-111111111115",
        name: "approve_users",
        description: "Approve/reject users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Role Management
      {
        id: "02222222-2222-2222-2222-222222222221",
        name: "view_roles",
        description: "View all roles",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "02222222-2222-2222-2222-222222222222",
        name: "create_roles",
        description: "Create new roles",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "02222222-2222-2222-2222-222222222223",
        name: "edit_roles",
        description: "Edit roles",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "02222222-2222-2222-2222-222222222224",
        name: "delete_roles",
        description: "Delete roles",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "02222222-2222-2222-2222-222222222225",
        name: "assign_roles",
        description: "Assign roles to users",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Organization Management
      {
        id: "03333333-3333-3333-3333-333333333331",
        name: "view_organizations",
        description: "View all organizations",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "03333333-3333-3333-3333-333333333332",
        name: "create_organizations",
        description: "Create organizations",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "03333333-3333-3333-3333-333333333333",
        name: "edit_organizations",
        description: "Edit organizations",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "03333333-3333-3333-3333-333333333334",
        name: "delete_organizations",
        description: "Delete organizations",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "03333333-3333-3333-3333-333333333335",
        name: "approve_organizations",
        description: "Approve/reject organizations",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Transaction Management
      {
        id: "04444444-4444-4444-4444-444444444441",
        name: "view_transactions",
        description: "View all transactions",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "04444444-4444-4444-4444-444444444442",
        name: "view_own_transactions",
        description: "View own transactions",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "04444444-4444-4444-4444-444444444443",
        name: "create_transactions",
        description: "Create transactions",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "04444444-4444-4444-4444-444444444444",
        name: "cancel_transactions",
        description: "Cancel transactions",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "04444444-4444-4444-4444-444444444445",
        name: "refund_transactions",
        description: "Process refunds",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Analytics & Reports
      {
        id: "05555555-5555-5555-5555-555555555551",
        name: "view_analytics",
        description: "View analytics dashboard",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "05555555-5555-5555-5555-555555555552",
        name: "view_reports",
        description: "View system reports",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "05555555-5555-5555-5555-555555555553",
        name: "export_data",
        description: "Export data",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // System Configuration
      {
        id: "06666666-6666-6666-6666-666666666661",
        name: "manage_settings",
        description: "Manage system settings",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "06666666-6666-6666-6666-666666666662",
        name: "manage_categories",
        description: "Manage categories",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "06666666-6666-6666-6666-666666666663",
        name: "view_audit_logs",
        description: "View audit logs",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Content Moderation
      {
        id: "07777777-7777-7777-7777-777777777771",
        name: "moderate_content",
        description: "Moderate user content",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "07777777-7777-7777-7777-777777777772",
        name: "manage_notifications",
        description: "Manage notifications",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Use INSERT ... ON CONFLICT for PostgreSQL upsert
    for (const permission of permissions) {
      try {
        await queryInterface.sequelize.query(
          `INSERT INTO "Permissions" ("id", "name", "description", "createdAt", "updatedAt")
           VALUES ('${permission.id}', '${permission.name}', '${permission.description}', '${permission.createdAt.toISOString()}', '${permission.updatedAt.toISOString()}')
           ON CONFLICT ("id") 
           DO UPDATE SET 
             "name" = EXCLUDED."name",
             "description" = EXCLUDED."description",
             "updatedAt" = EXCLUDED."updatedAt"`
        );
        console.log(`✓ Seeded permission: ${permission.name}`);
      } catch (error) {
        console.error(`✗ Failed to seed permission ${permission.name}:`, error.message);
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Permissions", null, {});
  },
};
