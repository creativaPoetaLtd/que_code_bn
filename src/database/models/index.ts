import { Sequelize } from "sequelize";
import organization_model from "./organization.model";
import organizationCategories_model from "./organizationCategories.model";
import user_model from "./user.model";
import profile_model from "./profiles.model";
import wallet_model from "./wallet.model";
import transaction_model from "./transaction.model";
import payment_model from "./payment.model";
import contact_model from "./contact.model";
import group_model from "./group.model";
import groupMember_model from "./groupMember.model";
import groupChatSettings_model from "./groupChatSettings.model";
import chat_model from "./chat.model";
import chatParticipant_model from "./chatParticipant.model";
import chatMessage_model from "./chatMessage.model";
import WalletRestriction_model from "./walletRestrictions.model";
import TransactionCategory_model from "./transactionCategories";
import ExternalAccount_model from "./externalAccounts.model";
import ContactInvitation_model from "./contactInvitations.model";
import notification_model from "./notification.model";
import role_model from "./role.model";
import permission_model from "./permission.model";
import rolePermission_model from "./rolePermission.model";
import userRole_model from "./userRole.model";

const Models = (sequelize: Sequelize) => {
  // Initialize models
  const Organization = organization_model(sequelize);
  const OrganizationCategory = organizationCategories_model(sequelize);
  const User = user_model(sequelize);
  const Profile = profile_model(sequelize);

  const Wallet = wallet_model(sequelize);
  const WalletRestriction = WalletRestriction_model(sequelize);
  const Transaction = transaction_model(sequelize);
  const TransactionCategory = TransactionCategory_model(sequelize);
  const Payment = payment_model(sequelize);
  const ExternalAccount = ExternalAccount_model(sequelize);

  const Contact = contact_model(sequelize);
  const ContactInvitation = ContactInvitation_model(sequelize);
  const Group = group_model(sequelize);
  const GroupMember = groupMember_model(sequelize);
  const GroupChatSettings = groupChatSettings_model(sequelize);
  const Chat = chat_model(sequelize);
  const ChatParticipant = chatParticipant_model(sequelize);
  const ChatMessage = chatMessage_model(sequelize);

  const Notification = notification_model(sequelize);

  const Role = role_model(sequelize);
  const Permission = permission_model(sequelize);
  const RolePermission = rolePermission_model(sequelize);
  const UserRole = userRole_model(sequelize);

  /* ---------- ASSOCIATIONS ---------- */

  // Profiles (1:1 with either User or Organization)
  User.hasOne(Profile, { foreignKey: "userId", as: "profile" });
  Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasOne(Profile, { foreignKey: "organizationId", as: "profile" });
  Profile.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  // Wallets
  User.hasOne(Wallet, { foreignKey: "userId", as: "wallet" });
  Wallet.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasOne(Wallet, { foreignKey: "organizationId", as: "wallet" });
  Wallet.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  Wallet.hasMany(WalletRestriction, {
    foreignKey: "walletId",
    as: "restrictions",
  });
  WalletRestriction.belongsTo(Wallet, { foreignKey: "walletId", as: "wallet" });

  TransactionCategory.hasMany(WalletRestriction, {
    foreignKey: "categoryId",
    as: "restrictions",
  });
  WalletRestriction.belongsTo(TransactionCategory, {
    foreignKey: "categoryId",
    as: "category",
  });

  // Transactions
  Wallet.hasMany(Transaction, {
    foreignKey: "senderWalletId",
    as: "sentTransactions",
  });
  Wallet.hasMany(Transaction, {
    foreignKey: "receiverWalletId",
    as: "receivedTransactions",
  });
  Transaction.belongsTo(Wallet, {
    foreignKey: "senderWalletId",
    as: "senderWallet",
  });
  Transaction.belongsTo(Wallet, {
    foreignKey: "receiverWalletId",
    as: "receiverWallet",
  });

  Transaction.belongsTo(TransactionCategory, {
    foreignKey: "categoryId",
    as: "category",
  });

  // Payments
  User.hasMany(Payment, { foreignKey: "userId", as: "payments" });
  Payment.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasMany(Payment, {
    foreignKey: "organizationId",
    as: "payments",
  });
  Payment.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  // Contacts
  User.hasMany(Contact, { foreignKey: "userAId", as: "contactsA" });
  User.hasMany(Contact, { foreignKey: "userBId", as: "contactsB" });
  Contact.belongsTo(User, { foreignKey: "userAId", as: "userA" });
  Contact.belongsTo(User, { foreignKey: "userBId", as: "userB" });

  User.hasMany(ContactInvitation, {
    foreignKey: "inviterId",
    as: "sentInvitations",
  });
  User.hasMany(ContactInvitation, {
    foreignKey: "inviteeId",
    as: "receivedInvitations",
  });
  ContactInvitation.belongsTo(User, { foreignKey: "inviterId", as: "inviter" });
  ContactInvitation.belongsTo(User, { foreignKey: "inviteeId", as: "invitee" });

  // Groups
  User.hasMany(Group, { foreignKey: "ownerId", as: "ownedGroups" });
  Group.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

  Group.hasMany(GroupMember, { foreignKey: "groupId", as: "members" });
  GroupMember.belongsTo(Group, { foreignKey: "groupId", as: "group" });

  User.hasMany(GroupMember, { foreignKey: "userId", as: "groupMemberships" });
  GroupMember.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(GroupMember, {
    foreignKey: "invitedBy",
    as: "groupInvitations",
  });
  GroupMember.belongsTo(User, { foreignKey: "invitedBy", as: "inviter" });

  // Group Chat Settings
  Group.hasOne(GroupChatSettings, { foreignKey: "groupId", as: "chatSettings" });
  GroupChatSettings.belongsTo(Group, { foreignKey: "groupId", as: "group" });

  // Chats
  Group.hasOne(Chat, { foreignKey: "groupId", as: "chat" });
  Chat.belongsTo(Group, { foreignKey: "groupId", as: "group" });
  Chat.hasMany(ChatParticipant, { foreignKey: "chatId", as: "participants" });
  ChatParticipant.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

  User.hasMany(ChatParticipant, {
    foreignKey: "userId",
    as: "chatMemberships",
  });
  ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });

  Chat.hasMany(ChatMessage, { foreignKey: "chatId", as: "messages" });
  ChatMessage.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

  User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages" });
  ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });

  // Message replies (self-referencing)
  ChatMessage.hasMany(ChatMessage, { foreignKey: "replyToMessageId", as: "replies" });
  ChatMessage.belongsTo(ChatMessage, { foreignKey: "replyToMessageId", as: "replyToMessage" });

  Transaction.hasOne(ChatMessage, {
    foreignKey: "transactionId",
    as: "message",
  });
  ChatMessage.belongsTo(Transaction, {
    foreignKey: "transactionId",
    as: "transaction",
  });

  // Notifications
  User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
  Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

  // External Accounts
  User.hasMany(ExternalAccount, {
    foreignKey: "userId",
    as: "externalAccounts",
  });
  ExternalAccount.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasMany(ExternalAccount, {
    foreignKey: "organizationId",
    as: "externalAccounts",
  });
  ExternalAccount.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  // Organization Categories
  OrganizationCategory.hasMany(Organization, {
    foreignKey: "categoryId",
    as: "organizations",
  });
  Organization.belongsTo(OrganizationCategory, {
    foreignKey: "categoryId",
    as: "Category",
  });

  // RBAC
  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: "roleId",
    as: "permissions",
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: "permissionId",
    as: "roles",
  });

  User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: "userId",
    as: "roles",
  });
  Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: "roleId",
    as: "users",
  });

  return {
    User,
    Organization,
    OrganizationCategory,
    Profile,
    Wallet,
    WalletRestriction,
    Transaction,
    TransactionCategory,
    Payment,
    ExternalAccount,
    Contact,
    ContactInvitation,
    Group,
    GroupMember,
    GroupChatSettings,
    Chat,
    ChatParticipant,
    ChatMessage,
    Notification,
    Role,
    Permission,
    RolePermission,
    UserRole,
  };
};

export default Models;
