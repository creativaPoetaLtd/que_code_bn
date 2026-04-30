"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MessageReactions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "ChatMessages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      emoji: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("MessageReactions", ["messageId"]);
    // Enforce one reaction per user per message
    await queryInterface.addIndex("MessageReactions", ["messageId", "userId"], {
      unique: true,
      name: "message_reactions_message_user_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MessageReactions");
  },
};
