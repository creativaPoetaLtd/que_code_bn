"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("RolePermissions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      roleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Roles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      permissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Permissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("RolePermissions", ["roleId"], {
      name: "idx_role_permissions_role_id",
    });
    await queryInterface.addIndex("RolePermissions", ["permissionId"], {
      name: "idx_role_permissions_permission_id",
    });
    await queryInterface.addIndex(
      "RolePermissions",
      ["roleId", "permissionId"],
      {
        name: "idx_role_permissions_role_permission",
        unique: true,
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("RolePermissions");
  },
};
