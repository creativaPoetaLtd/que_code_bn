"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Chats", "securityMode", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "legacy",
    });

    await queryInterface.addColumn("Chats", "protocolVersion", {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.sequelize.query(
      `UPDATE "Chats" SET "securityMode" = 'support_plain' WHERE "type" = 'support';`,
    );

    await queryInterface.createTable("UserDevices", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      deviceId: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      deviceName: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      platform: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      appVersion: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.createTable("DeviceKeyBundles", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userDeviceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "UserDevices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      algorithm: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      identityPublicKey: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      signedPreKeyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      signedPreKeyPublic: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      signedPreKeySignature: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      registrationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      uploadedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.createTable("DeviceOneTimePreKeys", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userDeviceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "UserDevices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      preKeyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      publicKey: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      usedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex("Chats", ["securityMode"], {
      name: "idx_chats_security_mode",
    });
    await queryInterface.addIndex("UserDevices", ["userId", "isActive"], {
      name: "idx_user_devices_user_active",
    });
    await queryInterface.addIndex("UserDevices", ["deviceId"], {
      name: "idx_user_devices_device_id",
      unique: true,
    });
    await queryInterface.addIndex("DeviceKeyBundles", ["userDeviceId"], {
      name: "idx_device_key_bundles_user_device_id",
      unique: true,
    });
    await queryInterface.addIndex("DeviceOneTimePreKeys", ["userDeviceId", "usedAt"], {
      name: "idx_device_one_time_pre_keys_device_used_at",
    });
    await queryInterface.addIndex("DeviceOneTimePreKeys", ["userDeviceId", "preKeyId"], {
      name: "idx_device_one_time_pre_keys_device_prekey",
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("DeviceOneTimePreKeys", "idx_device_one_time_pre_keys_device_prekey");
    await queryInterface.removeIndex("DeviceOneTimePreKeys", "idx_device_one_time_pre_keys_device_used_at");
    await queryInterface.removeIndex("DeviceKeyBundles", "idx_device_key_bundles_user_device_id");
    await queryInterface.removeIndex("UserDevices", "idx_user_devices_device_id");
    await queryInterface.removeIndex("UserDevices", "idx_user_devices_user_active");
    await queryInterface.removeIndex("Chats", "idx_chats_security_mode");

    await queryInterface.dropTable("DeviceOneTimePreKeys");
    await queryInterface.dropTable("DeviceKeyBundles");
    await queryInterface.dropTable("UserDevices");

    await queryInterface.removeColumn("Chats", "protocolVersion");
    await queryInterface.removeColumn("Chats", "securityMode");
  },
};
