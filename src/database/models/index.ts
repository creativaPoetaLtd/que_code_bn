import { Sequelize } from "sequelize";
import organization_model from "./organization.model";
import user_model from "./user.model";
import profile_model from "./profiles.model";
import wallet_model from "./wallet.model";
import transaction_model from "./transaction.model";
import payment_model from "./payment.model";
import contact_model from "./contact.model";
import group_model from "./group.model";
import groupMember_model from "./groupMember.model";
import chat_model from "./chat.model";
import chatParticipant_model from "./chatParticipant.model";
import chatMessage_model from "./chatMessage.model";
import chatKey_model from "./chatKey.model";
import userKey_model from "./userKey.model";
import WalletRestriction_model from "./walletRestrictions.model";
import Category_model from "./categories.model";
import ExternalAccount_model from "./externalAccounts.model";
import ContactInvitation_model from "./contactInvitations.model";
import notification_model from "./notification.model";
import pushSubscription_model from "./pushSubscription.model";
import deviceSession_model from "./deviceSession.model";
import role_model from "./role.model";
import permission_model from "./permission.model";
import rolePermission_model from "./rolePermission.model";
import userRole_model from "./userRole.model";
import action_model from "./action.model";
import subAction_model from "./subAction.model";
import actionPurchase_model from "./actionPurchase.model";
import qrObject_model from "./qrObject.model";
import auditLog_model from "./auditLog.model";
import paymentRequest_model from "./paymentRequest.model";
import galleryItem_model from "./galleryItem.model";
import outsideMessage_model from "./outsideMessage.model";
import messageReaction_model from "./messageReaction.model";

const Models = (sequelize: Sequelize) => {
  // Initialize models
  const Organization = organization_model(sequelize);
  const User = user_model(sequelize);
  const Profile = profile_model(sequelize);

  const Wallet = wallet_model(sequelize);
  const WalletRestriction = WalletRestriction_model(sequelize);
  const Transaction = transaction_model(sequelize);
  const Category = Category_model(sequelize);
  const Payment = payment_model(sequelize);
  const ExternalAccount = ExternalAccount_model(sequelize);

  const Contact = contact_model(sequelize);
  const ContactInvitation = ContactInvitation_model(sequelize);
  const Group = group_model(sequelize);
  const GroupMember = groupMember_model(sequelize);
  const Chat = chat_model(sequelize);
  const ChatParticipant = chatParticipant_model(sequelize);
  const ChatMessage = chatMessage_model(sequelize);
  const ChatKey = chatKey_model(sequelize);
  const UserKey = userKey_model(sequelize);

  const Notification = notification_model(sequelize);
  const PushSubscription = pushSubscription_model(sequelize);
  const DeviceSession = deviceSession_model(sequelize);

  const Role = role_model(sequelize);
  const Permission = permission_model(sequelize);
  const RolePermission = rolePermission_model(sequelize);
  const UserRole = userRole_model(sequelize);

  // Action models
  const Action = action_model(sequelize);
  const SubAction = subAction_model(sequelize);
  const ActionPurchase = actionPurchase_model(sequelize);
  const QRObject = qrObject_model(sequelize);
  const GalleryItem = galleryItem_model(sequelize);
  const OutsideMessage = outsideMessage_model(sequelize);

  // Audit model
  const AuditLog = auditLog_model(sequelize);

  // Payment Request model
  const PaymentRequest = paymentRequest_model(sequelize);
  const MessageReaction = messageReaction_model(sequelize);

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

  Group.hasOne(Wallet, { foreignKey: "groupId", as: "wallet" });
  Wallet.belongsTo(Group, {
    foreignKey: "groupId",
    as: "group",
  });

  Wallet.hasMany(WalletRestriction, {
    foreignKey: "walletId",
    as: "restrictions",
  });
  WalletRestriction.belongsTo(Wallet, { foreignKey: "walletId", as: "wallet" });

  Category.hasMany(WalletRestriction, {
    foreignKey: "categoryId",
    as: "restrictions",
  });
  WalletRestriction.belongsTo(Category, {
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

  Transaction.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  // Action associations
  Organization.hasMany(Action, { foreignKey: "organizationId", as: "actions" });
  Action.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  Action.hasMany(SubAction, { foreignKey: "actionId", as: "subActions" });
  SubAction.belongsTo(Action, { foreignKey: "actionId", as: "action" });

  SubAction.hasOne(Wallet, { foreignKey: "subActionId", as: "wallet" });
  Wallet.belongsTo(SubAction, { foreignKey: "subActionId", as: "subAction" });

  Action.hasMany(ActionPurchase, {
    foreignKey: "actionId",
    as: "purchases",
  });
  ActionPurchase.belongsTo(Action, { foreignKey: "actionId", as: "action" });

  SubAction.hasMany(ActionPurchase, {
    foreignKey: "subActionId",
    as: "purchases",
  });
  ActionPurchase.belongsTo(SubAction, {
    foreignKey: "subActionId",
    as: "subAction",
  });

  User.hasMany(ActionPurchase, {
    foreignKey: "buyerId",
    as: "actionPurchases",
  });
  ActionPurchase.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });

  Organization.hasMany(ActionPurchase, {
    foreignKey: "organizationId",
    as: "actionSales",
  });
  ActionPurchase.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "seller",
  });

  Transaction.hasOne(ActionPurchase, {
    foreignKey: "transactionId",
    as: "actionPurchase",
  });
  ActionPurchase.belongsTo(Transaction, {
    foreignKey: "transactionId",
    as: "transaction",
  });

  ActionPurchase.hasOne(QRObject, {
    foreignKey: "actionPurchaseId",
    as: "qrObject",
  });
  QRObject.belongsTo(ActionPurchase, {
    foreignKey: "actionPurchaseId",
    as: "actionPurchase",
  });

  User.hasMany(QRObject, { foreignKey: "buyerId", as: "qrObjects" });
  QRObject.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });

  Action.hasMany(QRObject, { foreignKey: "actionId", as: "qrObjects" });
  QRObject.belongsTo(Action, { foreignKey: "actionId", as: "action" });

  SubAction.hasMany(QRObject, {
    foreignKey: "subActionId",
    as: "qrObjects",
  });
  QRObject.belongsTo(SubAction, {
    foreignKey: "subActionId",
    as: "subAction",
  });

  // Transaction action links
  Action.hasMany(Transaction, { foreignKey: "actionId", as: "transactions" });
  Transaction.belongsTo(Action, { foreignKey: "actionId", as: "action" });

  SubAction.hasMany(Transaction, {
    foreignKey: "subActionId",
    as: "transactions",
  });
  Transaction.belongsTo(SubAction, {
    foreignKey: "subActionId",
    as: "subAction",
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

  // Payment Requests
  User.hasMany(PaymentRequest, { foreignKey: "senderId", as: "sentPaymentRequests" });
  User.hasMany(PaymentRequest, { foreignKey: "recipientId", as: "receivedPaymentRequests" });
  PaymentRequest.belongsTo(User, { foreignKey: "senderId", as: "sender" });
  PaymentRequest.belongsTo(User, { foreignKey: "recipientId", as: "recipient" });

  Transaction.hasOne(PaymentRequest, { foreignKey: "transactionId", as: "paymentRequest" });
  PaymentRequest.belongsTo(Transaction, { foreignKey: "transactionId", as: "transaction" });

  // Groups
  User.hasMany(Group, { foreignKey: "ownerId", as: "ownedGroups" });
  Group.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

  User.hasMany(Group, { foreignKey: "adminId", as: "adminGroups" });
  Group.belongsTo(User, { foreignKey: "adminId", as: "admin" });

  Group.hasMany(GroupMember, { foreignKey: "groupId", as: "members" });
  GroupMember.belongsTo(Group, { foreignKey: "groupId", as: "group" });

  User.hasMany(GroupMember, { foreignKey: "userId", as: "groupMemberships" });
  GroupMember.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(GroupMember, {
    foreignKey: "invitedBy",
    as: "groupInvitations",
  });
  GroupMember.belongsTo(User, { foreignKey: "invitedBy", as: "inviter" });

  User.hasMany(GroupMember, {
    foreignKey: "approvedBy",
    as: "approvedMemberships",
  });
  GroupMember.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });

  User.hasMany(GroupMember, {
    foreignKey: "rejectedBy",
    as: "rejectedMemberships",
  });
  GroupMember.belongsTo(User, { foreignKey: "rejectedBy", as: "rejector" });

  // Chats
  Chat.hasMany(ChatParticipant, { foreignKey: "chatId", as: "participants" });
  ChatParticipant.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

  User.hasMany(ChatParticipant, {
    foreignKey: "userId",
    as: "chatMemberships",
  });
  ChatParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });

  // Chat-Group association
  Group.hasOne(Chat, { foreignKey: "groupId", as: "chat" });
  Chat.belongsTo(Group, { foreignKey: "groupId", as: "group" });

  Chat.hasMany(ChatMessage, { foreignKey: "chatId", as: "messages" });
  ChatMessage.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

  User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages" });
  ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });

  Transaction.hasOne(ChatMessage, {
    foreignKey: "transactionId",
    as: "message",
  });
  ChatMessage.belongsTo(Transaction, {
    foreignKey: "transactionId",
    as: "transaction",
  });

  // Message Reactions
  ChatMessage.hasMany(MessageReaction, { foreignKey: "messageId", as: "reactions" });
  MessageReaction.belongsTo(ChatMessage, { foreignKey: "messageId", as: "message" });

  User.hasMany(MessageReaction, { foreignKey: "userId", as: "messageReactions" });
  MessageReaction.belongsTo(User, { foreignKey: "userId", as: "user" });

  // Chat Encryption Keys
  Chat.hasMany(ChatKey, { foreignKey: "chatId", as: "chatKeys" });
  ChatKey.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

  User.hasMany(ChatKey, { foreignKey: "userId", as: "chatKeys" });
  ChatKey.belongsTo(User, { foreignKey: "userId", as: "user" });

  // User Encryption Keys
  User.hasOne(UserKey, { foreignKey: "userId", as: "encryptionKeys" });
  UserKey.belongsTo(User, { foreignKey: "userId", as: "user" });

  // Notifications
  User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
  Notification.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(PushSubscription, {
    foreignKey: "userId",
    as: "pushSubscriptions",
  });
  PushSubscription.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(DeviceSession, {
    foreignKey: "userId",
    as: "deviceSessions",
  });
  DeviceSession.belongsTo(User, { foreignKey: "userId", as: "user" });
  Organization.hasMany(DeviceSession, {
    foreignKey: "organizationId",
    as: "deviceSessions",
  });
  DeviceSession.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

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

  User.hasMany(GalleryItem, { foreignKey: "userId", as: "galleryItems" });
  GalleryItem.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasMany(GalleryItem, {
    foreignKey: "organizationId",
    as: "galleryItems",
  });
  GalleryItem.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  // Organization Categories
  Category.hasMany(Organization, {
    foreignKey: "categoryId",
    as: "organizations",
  });
  Organization.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
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

  // Direct associations for UserRole and RolePermission tables
  User.hasMany(UserRole, { foreignKey: "userId", as: "userRoles" });
  UserRole.belongsTo(User, { foreignKey: "userId", as: "user" });

  Role.hasMany(UserRole, { foreignKey: "roleId", as: "userRoles" });
  UserRole.belongsTo(Role, { foreignKey: "roleId", as: "role" });

  Role.hasMany(RolePermission, { foreignKey: "roleId", as: "rolePermissions" });
  RolePermission.belongsTo(Role, { foreignKey: "roleId", as: "role" });

  Permission.hasMany(RolePermission, {
    foreignKey: "permissionId",
    as: "rolePermissions",
  });
  RolePermission.belongsTo(Permission, {
    foreignKey: "permissionId",
    as: "permission",
  });

  // Audit log associations
  User.hasMany(AuditLog, { foreignKey: "userId", as: "auditLogs" });
  AuditLog.belongsTo(User, { foreignKey: "userId", as: "user" });

  Organization.hasMany(AuditLog, {
    foreignKey: "organizationId",
    as: "auditLogs",
  });
  AuditLog.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  return {
    sequelize, // Add sequelize instance
    User,
    Organization,
    Profile,
    Wallet,
    WalletRestriction,
    Transaction,
    Category,
    Payment,
    ExternalAccount,
    Contact,
    ContactInvitation,
    Group,
    GroupMember,
    Chat,
    ChatParticipant,
    ChatMessage,
    ChatKey,
    UserKey,
    Notification,
    PushSubscription,
    DeviceSession,
    Role,
    Permission,
    RolePermission,
    UserRole,
    Action,
    SubAction,
    ActionPurchase,
    QRObject,
    AuditLog,
    PaymentRequest,
    OutsideMessage,
    GalleryItem,
    MessageReaction,
  };
};

export default Models;
