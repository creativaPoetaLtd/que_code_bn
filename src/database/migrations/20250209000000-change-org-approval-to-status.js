"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("🔧 Changing approvalStatus to status field...");

      // Add new status column
      await queryInterface.addColumn(
        "Organizations",
        "status",
        {
          type: Sequelize.ENUM("pending", "active", "inactive", "suspended"),
          allowNull: false,
          defaultValue: "pending",
        },
        { transaction },
      );

      // Migrate existing data: true -> active, false -> pending
      await queryInterface.sequelize.query(
        `UPDATE "Organizations" 
         SET status = CASE 
           WHEN "approvalStatus" = true THEN 'active'::"enum_Organizations_status"
           ELSE 'pending'::"enum_Organizations_status"
         END`,
        { transaction },
      );

      // Remove old approvalStatus column
      await queryInterface.removeColumn("Organizations", "approvalStatus", {
        transaction,
      });

      await transaction.commit();
      console.log("✅ Successfully migrated approvalStatus to status field");
    } catch (error) {
      await transaction.rollback();
      console.error("❌ Error migrating approvalStatus to status:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add back approvalStatus column
      await queryInterface.addColumn(
        "Organizations",
        "approvalStatus",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction },
      );

      // Migrate data back: active -> true, others -> false
      await queryInterface.sequelize.query(
        `UPDATE "Organizations" 
         SET "approvalStatus" = CASE 
           WHEN status = 'active' THEN true 
           ELSE false 
         END`,
        { transaction },
      );

      // Remove status column and enum type
      await queryInterface.removeColumn("Organizations", "status", {
        transaction,
      });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Organizations_status"',
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
