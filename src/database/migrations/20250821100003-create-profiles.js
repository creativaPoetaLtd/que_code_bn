"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Profiles_type') THEN
          CREATE TYPE "enum_Profiles_type" AS ENUM ('individual', 'organization');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable("Profiles", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("individual", "organization"),
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
      province: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      district: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sector: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cell: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      logo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      operationalDocument: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tinNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      profileImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      statusMessage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      qrCode: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      showPhoneOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showProfileImageOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showStatusMessageOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showProfileTypeOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showLocationOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showTinOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      showLogoOnWelcome: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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
    await queryInterface.addIndex("Profiles", ["qrCode"], {
      name: "idx_profiles_qr_code",
      unique: true,
    });
    await queryInterface.addIndex("Profiles", ["userId"], {
      name: "idx_profiles_user_id",
    });
    await queryInterface.addIndex("Profiles", ["organizationId"], {
      name: "idx_profiles_organization_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Profiles");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Profiles_type";'
    );
  },
};
