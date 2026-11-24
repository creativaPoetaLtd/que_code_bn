"use strict";

// An organization can ask QC to become a non-profit (NPO account type). The request
// stays on the organization until an admin approves it (sets accountTier = NPO) or
// rejects it; both clear these columns.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = await queryInterface.describeTable("Organizations", { transaction });
      if (!columns.npoRequestedAt) {
        await queryInterface.addColumn(
          "Organizations",
          "npoRequestedAt",
          { type: Sequelize.DATE, allowNull: true },
          { transaction }
        );
      }
      if (!columns.npoRequestNote) {
        await queryInterface.addColumn(
          "Organizations",
          "npoRequestNote",
          { type: Sequelize.TEXT, allowNull: true },
          { transaction }
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn("Organizations", "npoRequestNote", { transaction });
      await queryInterface.removeColumn("Organizations", "npoRequestedAt", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
