"use strict";

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === "string" ? table : table.tableName || table.name;
    return name === tableName;
  });
};

const getTableColumns = async (queryInterface, tableName) => {
  if (!(await tableExists(queryInterface, tableName))) {
    return {};
  }
  return queryInterface.describeTable(tableName);
};

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const columns = await getTableColumns(queryInterface, tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const createTableIfMissing = async (queryInterface, tableName, definition) => {
  if (!(await tableExists(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, definition);
  }
};

const indexExists = async (queryInterface, tableName, indexName) => {
  if (!(await tableExists(queryInterface, tableName))) {
    return false;
  }
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
};

const addIndexIfMissing = async (queryInterface, tableName, fields, options) => {
  if (!(await indexExists(queryInterface, tableName, options.name))) {
    await queryInterface.addIndex(tableName, fields, options);
  }
};

const removeIndexIfExists = async (queryInterface, tableName, indexName) => {
  if (await indexExists(queryInterface, tableName, indexName)) {
    await queryInterface.removeIndex(tableName, indexName);
  }
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumnIfMissing(queryInterface, "Chats", "securityMode", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "legacy",
    });

    await addColumnIfMissing(queryInterface, "Chats", "protocolVersion", {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.sequelize.query(
      `UPDATE "Chats" SET "securityMode" = 'support_plain' WHERE "type" = 'support';`,
    );

    await createTableIfMissing(queryInterface, "UserDevices", {
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

    await createTableIfMissing(queryInterface, "DeviceKeyBundles", {
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

    await createTableIfMissing(queryInterface, "DeviceOneTimePreKeys", {
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

    await addIndexIfMissing(queryInterface, "Chats", ["securityMode"], {
      name: "idx_chats_security_mode",
    });
    await addIndexIfMissing(queryInterface, "UserDevices", ["userId", "isActive"], {
      name: "idx_user_devices_user_active",
    });
    await addIndexIfMissing(queryInterface, "UserDevices", ["deviceId"], {
      name: "idx_user_devices_device_id",
      unique: true,
    });
    await addIndexIfMissing(queryInterface, "DeviceKeyBundles", ["userDeviceId"], {
      name: "idx_device_key_bundles_user_device_id",
      unique: true,
    });
    await addIndexIfMissing(queryInterface, "DeviceOneTimePreKeys", ["userDeviceId", "usedAt"], {
      name: "idx_device_one_time_pre_keys_device_used_at",
    });
    await addIndexIfMissing(queryInterface, "DeviceOneTimePreKeys", ["userDeviceId", "preKeyId"], {
      name: "idx_device_one_time_pre_keys_device_prekey",
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await removeIndexIfExists(queryInterface, "DeviceOneTimePreKeys", "idx_device_one_time_pre_keys_device_prekey");
    await removeIndexIfExists(queryInterface, "DeviceOneTimePreKeys", "idx_device_one_time_pre_keys_device_used_at");
    await removeIndexIfExists(queryInterface, "DeviceKeyBundles", "idx_device_key_bundles_user_device_id");
    await removeIndexIfExists(queryInterface, "UserDevices", "idx_user_devices_device_id");
    await removeIndexIfExists(queryInterface, "UserDevices", "idx_user_devices_user_active");
    await removeIndexIfExists(queryInterface, "Chats", "idx_chats_security_mode");

    if (await tableExists(queryInterface, "DeviceOneTimePreKeys")) {
      await queryInterface.dropTable("DeviceOneTimePreKeys");
    }
    if (await tableExists(queryInterface, "DeviceKeyBundles")) {
      await queryInterface.dropTable("DeviceKeyBundles");
    }
    if (await tableExists(queryInterface, "UserDevices")) {
      await queryInterface.dropTable("UserDevices");
    }

    const chatColumns = await getTableColumns(queryInterface, "Chats");
    if (chatColumns.protocolVersion) {
      await queryInterface.removeColumn("Chats", "protocolVersion");
    }
    if (chatColumns.securityMode) {
      await queryInterface.removeColumn("Chats", "securityMode");
    }
  },
};
