"use strict";

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
        console.log("ℹ️ Organizations table doesn't exist, skipping field additions");
        await transaction.commit();
        return;
      }

      // Check if contactPhone column already exists
      const [contactPhoneExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'contactPhone'
        );
      `, { transaction });
      
      if (!contactPhoneExists[0].exists) {
        await queryInterface.addColumn('Organizations', 'contactPhone', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ''
        }, { transaction });
        console.log("✅ Added contactPhone field to Organizations");
      } else {
        console.log("ℹ️ contactPhone field already exists in Organizations");
      }

      // Check if tinNumber column already exists
      const [tinNumberExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'tinNumber'
        );
      `, { transaction });
      
      if (!tinNumberExists[0].exists) {
        await queryInterface.addColumn('Organizations', 'tinNumber', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: ''
        }, { transaction });
        console.log("✅ Added tinNumber field to Organizations");
      } else {
        console.log("ℹ️ tinNumber field already exists in Organizations");
      }

      await transaction.commit();
      console.log("✅ Organization fields migration completed");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.removeColumn('Organizations', 'contactPhone', { transaction });
      await queryInterface.removeColumn('Organizations', 'tinNumber', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
