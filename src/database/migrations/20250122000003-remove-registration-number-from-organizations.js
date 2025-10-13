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
        console.log("ℹ️ Organizations table doesn't exist, skipping registrationNumber removal");
        await transaction.commit();
        return;
      }

      // Check if registrationNumber column exists before removing it
      const [registrationNumberExists] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Organizations'
          AND column_name = 'registrationNumber'
        );
      `, { transaction });
      
      if (registrationNumberExists[0].exists) {
        await queryInterface.removeColumn("Organizations", "registrationNumber", { transaction });
        console.log("✅ Removed registrationNumber column from Organizations table");
      } else {
        console.log("ℹ️ registrationNumber column doesn't exist in Organizations table");
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
      // Add back registrationNumber column
      await queryInterface.addColumn("Organizations", "registrationNumber", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
