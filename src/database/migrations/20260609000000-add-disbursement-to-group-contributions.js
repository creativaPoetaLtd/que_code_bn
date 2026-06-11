"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("GroupContributions");

    if (!tableDesc.disbursementPolicy) {
      await queryInterface.addColumn("GroupContributions", "disbursementPolicy", {
        type: Sequelize.ENUM("hold", "auto"),
        allowNull: false,
        defaultValue: "hold",
      });
    }

    if (!tableDesc.disbursementRecipientId) {
      await queryInterface.addColumn("GroupContributions", "disbursementRecipientId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!tableDesc.goalAmount) {
      // goalAmount was made nullable in a previous code change — ensure DB reflects that
    } else if (tableDesc.goalAmount && !tableDesc.goalAmount.allowNull) {
      await queryInterface.changeColumn("GroupContributions", "goalAmount", {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("GroupContributions", "disbursementRecipientId");
    await queryInterface.removeColumn("GroupContributions", "disbursementPolicy");
  },
};
