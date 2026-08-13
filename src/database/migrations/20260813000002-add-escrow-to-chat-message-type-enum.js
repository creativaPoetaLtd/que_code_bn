"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'escrow'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_ChatMessages_messageType')
        ) THEN
          ALTER TYPE "enum_ChatMessages_messageType" ADD VALUE 'escrow';
        END IF;
      END
      $$;
    `);
  },

  down: async () => {
    // Postgres does not support removing a value from an enum type; no-op.
  },
};
