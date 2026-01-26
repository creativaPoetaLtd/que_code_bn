"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${tableName}' AND column_name = '${columnName}'`
      );
      return results.length > 0;
    };

    // Add mediaUrl field for storing file URLs (Cloudinary or other storage)
    if (!(await columnExists("ChatMessages", "mediaUrl"))) {
      await queryInterface.addColumn("ChatMessages", "mediaUrl", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // Add mediaType field to specify the type of media
    if (!(await columnExists("ChatMessages", "mediaType"))) {
      await queryInterface.addColumn("ChatMessages", "mediaType", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add fileSize field to store file size in bytes
    if (!(await columnExists("ChatMessages", "fileSize"))) {
      await queryInterface.addColumn("ChatMessages", "fileSize", {
        type: Sequelize.BIGINT,
        allowNull: true,
      });
    }

    // Add thumbnailUrl field for video and document previews
    if (!(await columnExists("ChatMessages", "thumbnailUrl"))) {
      await queryInterface.addColumn("ChatMessages", "thumbnailUrl", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // Add fileName field to store original file name
    if (!(await columnExists("ChatMessages", "fileName"))) {
      await queryInterface.addColumn("ChatMessages", "fileName", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add mimeType field for proper file handling
    if (!(await columnExists("ChatMessages", "mimeType"))) {
      await queryInterface.addColumn("ChatMessages", "mimeType", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add duration field for audio and video files (in seconds)
    if (!(await columnExists("ChatMessages", "duration"))) {
      await queryInterface.addColumn("ChatMessages", "duration", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    // Update the messageType enum to include new media types
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- Drop the old enum type and recreate with new values
        ALTER TYPE "enum_ChatMessages_messageType" RENAME TO "enum_ChatMessages_messageType_old";
        
        CREATE TYPE "enum_ChatMessages_messageType" AS ENUM (
          'text', 
          'image', 
          'file', 
          'money', 
          'audio', 
          'video', 
          'document'
        );
        
        -- Update the column to use the new type
        ALTER TABLE "ChatMessages" 
        ALTER COLUMN "messageType" TYPE "enum_ChatMessages_messageType" 
        USING "messageType"::text::"enum_ChatMessages_messageType";
        
        -- Drop the old type
        DROP TYPE "enum_ChatMessages_messageType_old";
      END
      $$;
    `);

    // Add index for mediaUrl for faster lookups
    await queryInterface.addIndex("ChatMessages", ["mediaUrl"], {
      name: "idx_chat_messages_media_url",
      where: {
        mediaUrl: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn("ChatMessages", "mediaUrl");
    await queryInterface.removeColumn("ChatMessages", "mediaType");
    await queryInterface.removeColumn("ChatMessages", "fileSize");
    await queryInterface.removeColumn("ChatMessages", "thumbnailUrl");
    await queryInterface.removeColumn("ChatMessages", "fileName");
    await queryInterface.removeColumn("ChatMessages", "mimeType");
    await queryInterface.removeColumn("ChatMessages", "duration");

    // Remove the index
    await queryInterface.removeIndex(
      "ChatMessages",
      "idx_chat_messages_media_url"
    );

    // Revert the enum type back to original
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "enum_ChatMessages_messageType" RENAME TO "enum_ChatMessages_messageType_old";
        
        CREATE TYPE "enum_ChatMessages_messageType" AS ENUM (
          'text', 
          'image', 
          'file', 
          'money'
        );
        
        ALTER TABLE "ChatMessages" 
        ALTER COLUMN "messageType" TYPE "enum_ChatMessages_messageType" 
        USING "messageType"::text::"enum_ChatMessages_messageType";
        
        DROP TYPE "enum_ChatMessages_messageType_old";
      END
      $$;
    `);
  },
};
