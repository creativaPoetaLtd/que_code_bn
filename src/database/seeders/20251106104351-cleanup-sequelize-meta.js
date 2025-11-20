'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove old migration records that no longer have corresponding files
    await queryInterface.bulkDelete('SequelizeMeta', {
      name: [
        '20250115000000-unify-categories.js',
        '20250115000001-create-unified-categories.js',
        '20250115000002-drop-old-category-tables.js',
        '20250115000003-reset-database.js',
        '20250115000004-add-missing-organization-fields.js',
        '20250121120000-fix-invitation-token-length.js',
        '20250122000000-add-description-address-services-to-organizations.js',
        '20250122000001-update-organization-fields.js',
        '20250122000002-add-description-address-services-back-to-organizations.js',
        '20250122000002-add-owner-name-to-organizations.js',
        '20250122000003-remove-location-document-fields-from-organizations.js'
      ]
    });
    
    console.log('✅ Cleaned up old migration records from SequelizeMeta table');
  },

  down: async (queryInterface, Sequelize) => {
    // This operation is not reversible as we're cleaning up orphaned records
    console.log('⚠️ Cannot restore deleted migration records');
  }
};
