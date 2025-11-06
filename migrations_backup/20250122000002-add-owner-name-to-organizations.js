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
        console.log("ℹ️ Organizations table doesn't exist, skipping ownerName addition");
        await transaction.commit();
        return;
      }

      // Check if ownerName column already exists
      const [ownerNameExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'ownerName'
        );
      `, { transaction });
      
      if (!ownerNameExists[0].exists) {
        await queryInterface.addColumn('Organizations', 'ownerName', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Unknown Owner'
        }, { transaction });
        console.log("✅ Added ownerName field to Organizations table");
      } else {
        console.log("ℹ️ ownerName field already exists in Organizations table");
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
      // Remove ownerName field
      await queryInterface.removeColumn('Organizations', 'ownerName', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
