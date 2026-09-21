"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ChatMessages", "pinnedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("ChatMessages", "pinnedBy", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    // The pinned bar reads "the pins in this chat, newest first"
    await queryInterface.addIndex("ChatMessages", ["chatId", "pinnedAt"], {
      name: "idx_chat_messages_chat_id_pinned_at",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("ChatMessages", "idx_chat_messages_chat_id_pinned_at");
    await queryInterface.removeColumn("ChatMessages", "pinnedBy");
    await queryInterface.removeColumn("ChatMessages", "pinnedAt");
  },
};
