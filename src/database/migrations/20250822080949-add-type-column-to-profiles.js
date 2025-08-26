"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum type if it doesn't exist
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Profiles_type') THEN
          CREATE TYPE "enum_Profiles_type" AS ENUM ('individual', 'organization');
        END IF;
      END
      $$;
    `);

    // Add the type column
    await queryInterface.addColumn("Profiles", "type", {
      type: Sequelize.ENUM("individual", "organization"),
      allowNull: false,
      defaultValue: "individual",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the type column
    await queryInterface.removeColumn("Profiles", "type");

    // Drop the enum type if no other tables are using it
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Profiles_type";'
    );
  },
};
