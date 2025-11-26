"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add mediaUrl field for storing file URLs (Cloudinary or other storage)
    await queryInterface.addColumn('ChatMessages', 'mediaUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add mediaType field to specify the type of media
    await queryInterface.addColumn('ChatMessages', 'mediaType', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add fileSize field to store file size in bytes
    await queryInterface.addColumn('ChatMessages', 'fileSize', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    // Add thumbnailUrl field for video and document previews
    await queryInterface.addColumn('ChatMessages', 'thumbnailUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add fileName field to store original file name
    await queryInterface.addColumn('ChatMessages', 'fileName', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add mimeType field for proper file handling
    await queryInterface.addColumn('ChatMessages', 'mimeType', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add duration field for audio and video files (in seconds)
    await queryInterface.addColumn('ChatMessages', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

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
    await queryInterface.addIndex('ChatMessages', ['mediaUrl'], {
      name: 'idx_chat_messages_media_url',
      where: {
        mediaUrl: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn('ChatMessages', 'mediaUrl');
    await queryInterface.removeColumn('ChatMessages', 'mediaType');
    await queryInterface.removeColumn('ChatMessages', 'fileSize');
    await queryInterface.removeColumn('ChatMessages', 'thumbnailUrl');
    await queryInterface.removeColumn('ChatMessages', 'fileName');
    await queryInterface.removeColumn('ChatMessages', 'mimeType');
    await queryInterface.removeColumn('ChatMessages', 'duration');

    // Remove the index
    await queryInterface.removeIndex('ChatMessages', 'idx_chat_messages_media_url');

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
  }
};
