import { UUID } from "crypto";
import { Optional } from "sequelize";

export interface OrganizationModelAttributes {
  id: string;
  name: string;
  email: string;
  password: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  approvalStatus: boolean;
  categoryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrganizationCreationAttributes = Optional<
  OrganizationModelAttributes,
  "id" | "createdAt" | "updatedAt"
> & {
  name: string;
  email: string;
  password: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  approvalStatus?: boolean;
};

export interface UserModelAttributes {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  isVerified: boolean;
  approvalStatus: boolean;
  otp: string | null; // Nullable in model, as cleared after verification
  otpExpires: Date | null; // Nullable in model, as cleared after verification
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserModelAttributes,
  "id" | "createdAt" | "updatedAt" | "isVerified" | "approvalStatus"
> & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  otp: string; // Required for creation
  otpExpires: Date; // Required for creation
};

export interface ProfileModelAttributes {
  id: string;
  type: "individual" | "organization";
  userId?: string;
  organizationId?: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  logo?: string;
  operationalDocument?: string;
  tinNumber?: string;
  profileImage?: string;
  statusMessage?: string;
  qrCode: string;
  showPhoneOnWelcome: boolean;
  showProfileImageOnWelcome: boolean;
  showStatusMessageOnWelcome: boolean;
  showProfileTypeOnWelcome: boolean;
  showLocationOnWelcome: boolean;
  showTinOnWelcome: boolean;
  showLogoOnWelcome: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProfileCreationAttributes = Optional<
  ProfileModelAttributes,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "showPhoneOnWelcome"
  | "showProfileImageOnWelcome"
  | "showStatusMessageOnWelcome"
  | "showProfileTypeOnWelcome"
  | "showLocationOnWelcome"
  | "showTinOnWelcome"
  | "showLogoOnWelcome"
> & {
  type: "individual" | "organization";
  qrCode: string;
};

export interface WalletModelAttributes {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionModelAttributes {
  id: string;
  transactionId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  fee: number;
  totalAmount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  type: "transfer" | "deposit" | "withdrawal";
  description?: string;
  metadata?: any;
  processedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthenticatedUser extends UserModelAttributes {}

export interface ChatAttributes {
  id: string;
  isGroup: boolean;
  groupId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type ChatCreationAttributes = Omit<
  ChatAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface ChatMessageAttributes {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  messageType: "text" | "image" | "file" | "money" | "system" | "announcement";
  transactionId?: string;
  metadata?: any;
  replyToMessageId?: string;
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  readBy?: any;
  createdAt?: Date;
  updatedAt?: Date;
}
export type ChatMessageCreationAttributes = Omit<
  ChatMessageAttributes,
  "id" | "createdAt" | "updatedAt" | "isEdited" | "editedAt" | "deletedAt" | "readBy"
>;

export interface ChatParticipantAttributes {
  id: string;
  chatId: string;
  userId: string;
  joinedAt: Date;
  lastReadAt?: Date;
}
export type ChatParticipantCreationAttributes = Omit<
  ChatParticipantAttributes,
  "id"
>;

export interface ContactAttributes {
  id: string;
  userAId: string;
  userBId: string;
  status: "active" | "blocked";
  createdAt?: Date;
}
export type ContactCreationAttributes = Omit<
  ContactAttributes,
  "id" | "createdAt"
>;

export interface ContactInvitationAttributes {
  id: string;
  inviterId: string;
  inviteeId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  invitationToken: string;
  invitedAt: Date;
  respondedAt?: Date;
  expiresAt?: Date;
}
export type ContactInvitationCreationAttributes = Omit<
  ContactInvitationAttributes,
  "id"
>;

export interface ExternalAccountAttributes {
  id: string;
  userId?: string;
  organizationId?: string;
  provider: "mtn_momo" | "airtel_money" | "visa" | "mastercard" | "bank";
  accountNumber: string;
  providerRef?: string;
  label?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type ExternalAccountCreationAttributes = Omit<
  ExternalAccountAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface GroupAttributes {
  id: string;
  name: string;
  description?: string;
  picture?: string;
  ownerId: string;
  qrCode?: string;
  accessLink?: string;
  accessToken?: string;
  isPrivate: boolean;
  maxMembers?: number;
  memberCount?: number;
  walletId?: string;
  lifeTime?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type GroupCreationAttributes = Omit<
  GroupAttributes,
  "id" | "createdAt" | "updatedAt" | "memberCount"
>;

export interface GroupMemberAttributes {
  id: string;
  groupId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "left" | "removed";
  invitedBy?: string;
  joinedAt?: Date;
  invitedAt?: Date;
  respondedAt?: Date;
  lastReadAt?: Date;
}
export type GroupMemberCreationAttributes = Omit<GroupMemberAttributes, "id">;

export interface GroupChatSettingsAttributes {
  id: string;
  groupId: string;
  canMembersInvite: boolean;
  canMembersDeleteMessages: boolean;
  onlyAdminsCanPost: boolean;
  messageRetentionDays?: number;
  allowFileSharing: boolean;
  allowMoneyTransfers: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  profanityFilter: boolean;
  linkPreview: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  slowMode?: number;
  announcementMode: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type GroupChatSettingsCreationAttributes = Omit<
  GroupChatSettingsAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: string;
  data: object;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type NotificationCreationAttributes = Omit<
  NotificationAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface OrganizationCategoryAttributes {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type OrganizationCategoryCreationAttributes = Omit<
  OrganizationCategoryAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface PaymentAttributes {
  id: string;
  userId?: string;
  organizationId?: string;
  linkId: string;
  url: string;
  amount: number;
  description?: string;
  expiresAt?: Date;
  isActive: boolean;
  usageCount: number;
  maxUsage: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PaymentCreationAttributes = Omit<
  PaymentAttributes,
  "id" | "usageCount" | "createdAt" | "updatedAt"
>;

export interface PermissionAttributes {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PermissionCreationAttributes = Omit<
  PermissionAttributes,
  "id" | "createdAt" | "updatedAt"
>;
export interface RoleAttributes {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type RoleCreationAttributes = Omit<
  RoleAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface RolePermissionAttributes {
  id: string;
  roleId: string;
  permissionId: string;
}
export type RolePermissionCreationAttributes = Omit<
  RolePermissionAttributes,
  "id"
>;
export interface TransactionAttributes {
  id: string;
  referenceId: string;
  senderWalletId: string;
  receiverWalletId: string;
  amount: number;
  fee: number;
  totalAmount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  type: "transfer" | "payment" | "donation" | "vote" | "topup" | "withdrawal";
  externalSenderName?: string;
  externalSenderContact?: string;
  externalSenderProvider?:
    | "mtn_momo"
    | "airtel_money"
    | "bank"
    | "visa"
    | "mastercard"
    | "paypal"
    | "other";
  externalSenderReference?: string;
  categoryId?: string;
  spendConstraintType?: "none" | "category" | "recipient";
  constraintCategoryId?: string;
  constraintRecipientWalletId?: string;
  description?: string;
  hasAccount?: boolean;
  senderNames?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TransactionCreationAttributes = Omit<
  TransactionAttributes,
  "id" | "createdAt" | "updatedAt" | "totalAmount" | "fee"
>;

export interface TransactionCategoryAttributes {
  id: string;
  name: string;
  description?: string;
  isRestricted: boolean;
  requiresOrgCategoryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type TransactionCategoryCreationAttributes = Omit<
  TransactionCategoryAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface UserRoleAttributes {
  id: string;
  userId: string;
  roleId: string;
}
export type UserRoleCreationAttributes = Omit<UserRoleAttributes, "id">;

export interface VerificationTokenAttributes {
  id: string;
  userId: string;
  type: "password_reset" | "email_verification" | "phone_verification";
  token: string;
  expiresAt: Date;
  createdAt?: Date;
}
export type VerificationTokenCreationAttributes = Omit<
  VerificationTokenAttributes,
  "id" | "createdAt"
>;

export interface WalletAttributes {
  id: string;
  userId?: string;
  organizationId?: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type WalletCreationAttributes = Omit<
  WalletAttributes,
  "id" | "balance" | "currency" | "isActive" | "createdAt" | "updatedAt"
>;

export interface WalletRestrictionAttributes {
  id: string;
  walletId: string;
  categoryId: string;
  amount: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type WalletRestrictionCreationAttributes = Omit<
  WalletRestrictionAttributes,
  "id" | "createdAt" | "updatedAt"
>;
