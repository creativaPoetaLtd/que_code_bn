'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // First check if tables exist and drop them completely
      const [groupsResult] = await queryInterface.sequelize.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Groups')",
        { transaction }
      );
      const [groupMembersResult] = await queryInterface.sequelize.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GroupMembers')",
        { transaction }
      );

      // Drop tables if they exist
      if (groupMembersResult[0].exists) {
        await queryInterface.dropTable('GroupMembers', { transaction, cascade: true });
      }
      if (groupsResult[0].exists) {
        await queryInterface.dropTable('Groups', { transaction, cascade: true });
      }

      // Drop enum types if they exist
      try {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Groups_privacyType" CASCADE', { transaction });
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Groups_expirationType" CASCADE', { transaction });
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_role" CASCADE', { transaction });
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GroupMembers_status" CASCADE', { transaction });
      } catch (error) {
        console.log('Some enum types did not exist, continuing...');
      }

      // Create Groups table with all enhanced features
      await queryInterface.createTable('Groups', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        picture: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        ownerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        adminId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        qrCode: {
          type: Sequelize.TEXT, // Changed from STRING to TEXT to handle base64 data
          allowNull: true,
        },
        accessLink: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        accessToken: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        isPrivate: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        privacyType: {
          type: Sequelize.ENUM('private', 'public', 'require_approval'),
          defaultValue: 'require_approval',
        },
        maxMembers: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        memberCount: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        hasFundraising: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        fundraisingTarget: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true,
        },
        fundraisingCurrentAmount: {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 0.00,
        },
        expirationDate: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        expirationType: {
          type: Sequelize.ENUM('custom_date', 'target_reached', 'deadline_reached', 'never'),
          defaultValue: 'never',
        },
        hasAdditionalInfo: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        additionalInfoPrompt: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        profilePictureUrl: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        profilePicturePublicId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        walletId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        lifeTime: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }, { transaction });

      // Create GroupMembers table with enhanced features
      await queryInterface.createTable('GroupMembers', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        groupId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Groups',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        role: {
          type: Sequelize.ENUM('owner', 'admin', 'member'),
          defaultValue: 'member',
        },
        status: {
          type: Sequelize.ENUM('pending', 'active', 'left', 'removed', 'rejected'),
          defaultValue: 'pending',
        },
        invitedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        joinedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        invitedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        respondedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        invitationMessage: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        additionalInfo: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        autoApproved: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        approvedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        rejectedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        rejectedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        rejectionReason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }, { transaction });

      // Add indexes for better performance
      await queryInterface.addIndex('Groups', ['ownerId'], { transaction });
      await queryInterface.addIndex('Groups', ['adminId'], { transaction });
      await queryInterface.addIndex('Groups', ['privacyType'], { transaction });
      await queryInterface.addIndex('Groups', ['expirationDate'], { transaction });
      
      await queryInterface.addIndex('GroupMembers', ['groupId'], { transaction });
      await queryInterface.addIndex('GroupMembers', ['userId'], { transaction });
      await queryInterface.addIndex('GroupMembers', ['status'], { transaction });
      await queryInterface.addIndex('GroupMembers', ['role'], { transaction });
      await queryInterface.addIndex('GroupMembers', ['invitedBy'], { transaction });
      
      // Composite indexes for common queries
      await queryInterface.addIndex('GroupMembers', ['groupId', 'status'], { transaction });
      await queryInterface.addIndex('GroupMembers', ['userId', 'status'], { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop foreign key constraint from Wallets if it exists
      await queryInterface.sequelize.query(
        `ALTER TABLE "Wallets" DROP CONSTRAINT IF EXISTS "Wallets_groupId_fkey";`,
        { transaction }
      );

      // Drop foreign key constraints from other dependent tables if they exist
      const dependentTables = ['ChatParticipants', 'Chats', 'Notifications'];
      for (const table of dependentTables) {
        const tableExists = await queryInterface.sequelize.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}';`,
          { transaction, type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        
        if (tableExists.length > 0) {
          await queryInterface.sequelize.query(
            `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_groupId_fkey";`,
            { transaction }
          );
        }
      }

      // Now we can safely drop the tables
      await queryInterface.dropTable('GroupMembers', { transaction });
      await queryInterface.dropTable('Groups', { transaction });
      
      // Drop enum types
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Groups_privacyType";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Groups_expirationType";', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};