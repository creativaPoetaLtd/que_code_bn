"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("GalleryItems")) {
      await queryInterface.createTable("GalleryItems", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        organizationId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "Organizations",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        imageUrl: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        caption: {
          type: Sequelize.STRING,
          allowNull: true,
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

      await queryInterface.addIndex("GalleryItems", ["userId"], {
        name: "idx_gallery_items_user_id",
      });
      await queryInterface.addIndex("GalleryItems", ["organizationId"], {
        name: "idx_gallery_items_organization_id",
      });
      await queryInterface.addIndex("GalleryItems", ["createdAt"], {
        name: "idx_gallery_items_created_at",
      });
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("GalleryItems")) {
      await queryInterface.dropTable("GalleryItems");
    }
  },
};
