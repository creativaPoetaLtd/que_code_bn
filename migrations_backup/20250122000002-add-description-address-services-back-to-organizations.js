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

      const fieldsToAdd = [
        { name: 'description', config: { type: Sequelize.TEXT, allowNull: true } },
        { name: 'address', config: { type: Sequelize.TEXT, allowNull: true } },
        { name: 'services', config: { type: Sequelize.JSON, allowNull: true, defaultValue: [] } }
      ];

      for (const field of fieldsToAdd) {
        const [fieldExists] = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Organizations'
            AND column_name = '${field.name}'
          );
        `, { transaction });
        
        if (!fieldExists[0].exists) {
          await queryInterface.addColumn("Organizations", field.name, field.config, { transaction });
          console.log(`✅ Added ${field.name} column back to Organizations`);
        } else {
          console.log(`ℹ️ ${field.name} column already exists in Organizations`);
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
      // Remove the added columns
      await queryInterface.removeColumn("Organizations", "description", { transaction });
      await queryInterface.removeColumn("Organizations", "address", { transaction });
      await queryInterface.removeColumn("Organizations", "services", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
