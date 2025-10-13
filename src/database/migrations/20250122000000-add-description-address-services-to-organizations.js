"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if Organizations table exists
      const [organizationsExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
        );
      `);
      
      if (!organizationsExists[0].exists) {
        console.log("ℹ️ Organizations table doesn't exist, skipping field additions");
        return;
      }

      // Add description column if it doesn't exist
      const [descriptionExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'description'
        );
      `);
      
      if (!descriptionExists[0].exists) {
        await queryInterface.addColumn("Organizations", "description", {
          type: Sequelize.TEXT,
          allowNull: true,
        });
        console.log("✅ Added description column to Organizations");
      }

      // Add address column if it doesn't exist
      const [addressExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'address'
        );
      `);
      
      if (!addressExists[0].exists) {
        await queryInterface.addColumn("Organizations", "address", {
          type: Sequelize.TEXT,
          allowNull: true,
        });
        console.log("✅ Added address column to Organizations");
      }

      // Add services column if it doesn't exist
      const [servicesExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'services'
        );
      `);
      
      if (!servicesExists[0].exists) {
        await queryInterface.addColumn("Organizations", "services", {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
        });
        console.log("✅ Added services column to Organizations");
      }
    } catch (error) {
      console.log("Error in add-description-address-services migration:", error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn("Organizations", "description");
    await queryInterface.removeColumn("Organizations", "address");
    await queryInterface.removeColumn("Organizations", "services");
  },
};

