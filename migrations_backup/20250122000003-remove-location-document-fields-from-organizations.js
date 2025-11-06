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
        console.log("ℹ️ Organizations table doesn't exist, skipping field removals");
        await transaction.commit();
        return;
      }

      // Remove location and document fields from Organizations table
      // These fields are now handled in the Profiles table
      const fieldsToRemove = ['province', 'district', 'sector', 'cell', 'logo', 'operationalDocument'];
      
      for (const field of fieldsToRemove) {
        try {
          const [fieldExists] = await queryInterface.sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'Organizations'
              AND column_name = '${field}'
            );
          `, { transaction });
          
          if (fieldExists[0].exists) {
            await queryInterface.removeColumn('Organizations', field, { transaction });
            console.log(`✅ Removed ${field} field from Organizations table`);
          } else {
            console.log(`ℹ️ ${field} field doesn't exist in Organizations table`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not remove ${field} field: ${error.message}`);
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
      // Add back the location and document fields to Organizations table
      await queryInterface.addColumn('Organizations', 'province', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'district', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'sector', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'cell', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: ''
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'logo', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Organizations', 'operationalDocument', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
