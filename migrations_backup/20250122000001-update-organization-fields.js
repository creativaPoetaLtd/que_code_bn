'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if Organizations table exists
      const [organizationsExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
        );
      `, { transaction });
      
      if (!organizationsExists[0].exists) {
        console.log("ℹ️ Organizations table doesn't exist, skipping field updates");
        await transaction.commit();
        return;
      }

      // Define columns to add
      const columnsToAdd = [
        { name: 'type', config: { type: Sequelize.STRING, allowNull: false, defaultValue: 'organization' } },
        { name: 'contactPhone', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'tinNumber', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'registrationNumber', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'province', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'district', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'sector', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } }
      ];

      // Add columns if they don't exist
      for (const column of columnsToAdd) {
        const [columnExists] = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Organizations'
            AND column_name = '${column.name}'
          );
        `, { transaction });
        
        if (!columnExists[0].exists) {
          await queryInterface.addColumn('Organizations', column.name, column.config, { transaction });
          console.log(`✅ Added ${column.name} column to Organizations`);
        } else {
          console.log(`ℹ️ ${column.name} column already exists in Organizations`);
        }
      }

      // Add additional columns
      const additionalColumns = [
        { name: 'cell', config: { type: Sequelize.STRING, allowNull: false, defaultValue: '' } },
        { name: 'logo', config: { type: Sequelize.STRING, allowNull: true } },
        { name: 'operationalDocument', config: { type: Sequelize.STRING, allowNull: true } }
      ];

      for (const column of additionalColumns) {
        const [columnExists] = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Organizations'
            AND column_name = '${column.name}'
          );
        `, { transaction });
        
        if (!columnExists[0].exists) {
          await queryInterface.addColumn('Organizations', column.name, column.config, { transaction });
          console.log(`✅ Added ${column.name} column to Organizations`);
        }
      }

      // Remove old fields that are no longer needed (only if they exist)
      const columnsToRemove = ['ownerName', 'description', 'address', 'services'];
      
      for (const columnName of columnsToRemove) {
        try {
          const [columnExists] = await queryInterface.sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'Organizations'
              AND column_name = '${columnName}'
            );
          `, { transaction });
          
          if (columnExists[0].exists) {
            await queryInterface.removeColumn('Organizations', columnName, { transaction });
            console.log(`✅ Removed ${columnName} column from Organizations`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not remove ${columnName} column: ${error.message}`);
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove new fields
      await queryInterface.removeColumn('Organizations', 'type', { transaction });
      await queryInterface.removeColumn('Organizations', 'contactPhone', { transaction });
      await queryInterface.removeColumn('Organizations', 'tinNumber', { transaction });
      await queryInterface.removeColumn('Organizations', 'registrationNumber', { transaction });
      await queryInterface.removeColumn('Organizations', 'province', { transaction });
      await queryInterface.removeColumn('Organizations', 'district', { transaction });
      await queryInterface.removeColumn('Organizations', 'sector', { transaction });
      await queryInterface.removeColumn('Organizations', 'cell', { transaction });
      await queryInterface.removeColumn('Organizations', 'logo', { transaction });
      await queryInterface.removeColumn('Organizations', 'operationalDocument', { transaction });

      // Add back old fields
      await queryInterface.addColumn('Organizations', 'ownerName', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'address', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'services', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
