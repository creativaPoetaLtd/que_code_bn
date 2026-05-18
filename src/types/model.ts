import { UUID } from "crypto";
import { Optional } from "sequelize";

export type OrganizationStatus =
  | "pending"
  | "active"
  | "inactive"
  | "suspended";

export interface OrganizationModelAttributes {
  id: string;
  name: string;
  email: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  contactPhone: string;
  tinNumber: string;

  password: string;
  status: OrganizationStatus;
  categoryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrganizationCreationAttributes = Optional<
  OrganizationModelAttributes,
  "id" | "createdAt" | "updatedAt" | "status"
>;

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
  transactionPin: string | null; // Hashed 4-digit PIN for transactions
  hasPinSet: boolean; // Whether user has set up their PIN
  pinAttempts: number; // Number of failed PIN attempts
  pinLockedUntil: Date | null; // Temporary lockout timestamp
  isOnline?: boolean; // Online status
  lastSeen?: Date; // Last seen timestamp
  pinResetOtp: string | null; // OTP for PIN reset
  pinResetOtpExpires: Date | null; // PIN reset OTP expiration
  fcmToken?: string | null; // Firebase Cloud Messaging token
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserModelAttributes,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "isVerified"
  | "approvalStatus"
  | "transactionPin"
  | "hasPinSet"
  | "pinAttempts"
  | "pinLockedUntil"
  | "pinResetOtp"
  | "pinResetOtpExpires"
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
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
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
  showCategoryOnWelcome: boolean;
  showSocialLinksOnWelcome: boolean;
  showGalleryOnWelcome: boolean;
  showOrgStatsOnWelcome: boolean;
  showActionsOnWelcome: boolean;
  showSendMoneyOnWelcome: boolean;
  showContactFormOnWelcome: boolean;
  showOtherInfoOnWelcome: boolean;
  showFriendRequestOnWelcome: boolean;
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
  | "showCategoryOnWelcome"
  | "showSocialLinksOnWelcome"
  | "showGalleryOnWelcome"
  | "showOrgStatsOnWelcome"
  | "showActionsOnWelcome"
  | "showSendMoneyOnWelcome"
  | "showContactFormOnWelcome"
  | "showOtherInfoOnWelcome"
  | "showFriendRequestOnWelcome"
> & {
  type: "individual" | "organization";
  qrCode: string;
};

export interface GalleryItemModelAttributes {
  id: string;
  userId?: string;
  organizationId?: string;
  imageUrl: string;
  caption?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GalleryItemCreationAttributes = Omit<
  GalleryItemModelAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface OutsideMessageModelAttributes {
  id: string;
  receiverId: string;
  senderName: string;
  senderContact: string;
  message: string;
  status: "unread" | "read";
  readAt?: Date | null;
  source?: string;
  meta?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OutsideMessageCreationAttributes = Omit<
  OutsideMessageModelAttributes,
  "id" | "createdAt" | "updatedAt"
>;

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
  type?: string;
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
  messageType:
    | "text"
    | "image"
    | "file"
    | "money"
    | "audio"
    | "video"
    | "document";
  replyToMessageId?: string;
  transactionId?: string;
  isEncrypted: boolean;
  encryptionIv?: string;
  status: "sent" | "delivered" | "read";
  deliveredAt?: Date;
  readAt?: Date;
  // Media fields
  mediaUrl?: string;
  mediaType?: string;
  fileSize?: number;
  thumbnailUrl?: string;
  fileName?: string;
  mimeType?: string;
  duration?: number;
  // @mention data
  mentions?: Array<{ userId: string; username: string }>;
  createdAt?: Date;
  updatedAt?: Date;
}
export type ChatMessageCreationAttributes = Omit<
  ChatMessageAttributes,
  "id" | "createdAt" | "updatedAt"
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
  userAIsFavorite: boolean;
  userBIsFavorite: boolean;
  userATags: string[];
  userBTags: string[];
  createdAt?: Date;
}
export type ContactCreationAttributes = Optional<
  ContactAttributes,
  | "id"
  | "createdAt"
  | "userAIsFavorite"
  | "userBIsFavorite"
  | "userATags"
  | "userBTags"
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
  createdAt?: Date;
  updatedAt?: Date;
  // Association properties
  inviter?: UserModelAttributes;
  invitee?: UserModelAttributes;
}
export type ContactInvitationCreationAttributes = Omit<
  ContactInvitationAttributes,
  "id" | "inviter" | "invitee" | "createdAt" | "updatedAt"
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
  adminId?: string;
  qrCode?: string;
  accessLink?: string;
  accessToken?: string;
  isPrivate: boolean;
  privacyType: "private" | "public" | "require_approval";
  maxMembers?: number;
  memberCount?: number;
  hasFundraising: boolean;
  fundraisingTarget?: number;
  fundraisingCurrentAmount: number;
  expirationDate?: Date;
  expirationType:
    | "custom_date"
    | "target_reached"
    | "deadline_reached"
    | "never";
  hasAdditionalInfo: boolean;
  additionalInfoPrompt?: string;
  profilePictureUrl?: string;
  profilePicturePublicId?: string;
  walletId?: string;
  lifeTime?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type GroupCreationAttributes = Omit<
  GroupAttributes,
  "id" | "createdAt" | "updatedAt" | "memberCount" | "fundraisingCurrentAmount"
>;

export interface GroupMemberAttributes {
  id: string;
  groupId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "active" | "left" | "removed" | "rejected";
  invitedBy?: string;
  joinedAt?: Date;
  invitedAt?: Date;
  respondedAt?: Date;
  invitationMessage?: string;
  additionalInfo?: string;
  autoApproved: boolean;
  approvedBy?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export type GroupMemberCreationAttributes = Omit<
  GroupMemberAttributes,
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

export interface PushSubscriptionAttributes {
  id: string;
  userId: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
    preferences?: {
      soundEnabled?: boolean;
      vibrationEnabled?: boolean;
    };
  };
  userAgent?: string | null;
  isActive: boolean;
  lastSeenAt?: Date | null;
  lastSuccessfulAt?: Date | null;
  lastFailureAt?: Date | null;
  lastFailureReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PushSubscriptionCreationAttributes = Optional<
  PushSubscriptionAttributes,
  | "id"
  | "userAgent"
  | "isActive"
  | "lastSeenAt"
  | "lastSuccessfulAt"
  | "lastFailureAt"
  | "lastFailureReason"
  | "createdAt"
  | "updatedAt"
>;

export interface DeviceSessionAttributes {
  id: string;
  userId?: string | null;
  organizationId?: string | null;
  accountType: "user" | "organization";
  refreshTokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  isActive: boolean;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
export type DeviceSessionCreationAttributes = Optional<
  DeviceSessionAttributes,
  | "id"
  | "userId"
  | "organizationId"
  | "userAgent"
  | "ipAddress"
  | "isActive"
  | "lastUsedAt"
  | "revokedAt"
  | "createdAt"
  | "updatedAt"
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
  // Action-related fields (optional for backward compatibility)
  actionPurchaseId?: string;
  actionId?: string;
  subActionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TransactionCreationAttributes = Omit<
  TransactionAttributes,
  "id" | "createdAt" | "updatedAt" | "totalAmount" | "fee"
>;

export interface CategoryAttributes {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type CategoryCreationAttributes = Omit<
  CategoryAttributes,
  "id" | "createdAt" | "updatedAt"
>;

// Keep old interfaces for backward compatibility during migration
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
  groupId?: string;
  subActionId?: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export type WalletCreationAttributes = Omit<
  WalletAttributes,
  "id" | "currency" | "isActive" | "createdAt" | "updatedAt"
> & {
  balance?: number;
};

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

// Action-related types
export interface ActionModelAttributes {
  id: string;
  organizationId: string;
  type:
    | "ticket"
    | "transport"
    | "service"
    | "subscription"
    | "payment"
    | "donation"
    | "vote"
    | "booking"
    | "license"
    | "membership"
    | "rental"
    | "group";
  name: string;
  slug: string;
  displayLayout: "mosaic" | "list" | "icons" | "card";
  coverImage: string | null;
  shortDescription: string | null;
  description: string | null;
  currency: string;
  taxProfileId: string | null;
  pricing: any; // JSON
  availability: any; // JSON
  visibility: any; // JSON
  buyerFields: any; // JSON
  fulfillment: any; // JSON
  policy: any; // JSON
  webhooks: any; // JSON
  customFields: any; // JSON
  status: "draft" | "published" | "archived" | "suspended";
  dedicatedQrCode: string | null;
  dedicatedQrCodeData: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ActionCreationAttributes = Omit<
  ActionModelAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface SubActionModelAttributes {
  id: string;
  actionId: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  stockReserved: number;
  variants: any; // JSON
  metadata: any; // JSON
  isActive: boolean;
  sortOrder: number;
  coverImage: string | null;
  dedicatedQrCodeData: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SubActionCreationAttributes = Omit<
  SubActionModelAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface ActionPurchaseModelAttributes {
  id: string;
  actionId: string;
  subActionId: string | null;
  buyerId: string;
  organizationId: string;
  transactionId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  buyerData: any; // JSON
  status: "pending" | "completed" | "cancelled" | "refunded";
  qrObjectId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ActionPurchaseCreationAttributes = Omit<
  ActionPurchaseModelAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export interface QRObjectModelAttributes {
  id: string;
  buyerId: string;
  actionId: string;
  actionPurchaseId: string;
  subActionId: string | null;
  type:
    | "eticket"
    | "badge"
    | "license"
    | "membership"
    | "booking"
    | "transport"
    | "subscription";
  metadata: any; // JSON
  status: "valid" | "used" | "expired" | "revoked";
  issuedAt: Date;
  validUntil: Date | null;
  usedAt: Date | null;
  qrCodeData: string;
  coverImage: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QRObjectCreationAttributes = Omit<
  QRObjectModelAttributes,
  "id" | "createdAt" | "updatedAt" | "issuedAt"
>;

export interface AuditLogModelAttributes {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  method: string;
  endpoint: string;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  requestBody: Record<string, any> | null;
  responseBody: Record<string, any> | null;
  metadata: Record<string, any> | null;
  duration: number | null;
  level: "info" | "warning" | "error" | "critical";
  createdAt?: Date;
  updatedAt?: Date;
}


export interface AuditLogCreationAttributes extends Optional<
  AuditLogModelAttributes,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "userId"
  | "organizationId"
  | "ipAddress"
  | "userAgent"
  | "requestBody"
  | "responseBody"
  | "metadata"
  | "duration"
> {}

export interface PaymentRequestAttributes {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  currency: string;
  note: string | null;
  status: "pending" | "paid" | "cancelled" | "expired";
  allowEditAmount: boolean;
  transactionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentRequestCreationAttributes = Optional<
  PaymentRequestAttributes,
  "id" | "status" | "currency" | "allowEditAmount" | "note" | "transactionId" | "createdAt" | "updatedAt"
>;

export interface GroupContributionAttributes {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  note?: string | null;
  goalAmount: number;
  type: "fixed" | "flexible";
  amountPerMember?: number | null;
  minimumAmount?: number | null;
  deadline?: Date | null;
  status: "active" | "completed" | "closed" | "expired";
  visibilityMode: "all" | "admin_only";
  currency: string;
  collectedAmount: number;
  contributorCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupContributionCreationAttributes = Optional<
  GroupContributionAttributes,
  | "id"
  | "note"
  | "amountPerMember"
  | "minimumAmount"
  | "deadline"
  | "status"
  | "visibilityMode"
  | "currency"
  | "collectedAmount"
  | "contributorCount"
  | "createdAt"
  | "updatedAt"
>;

export interface GroupContributionPaymentAttributes {
  id: string;
  contributionId: string;
  payerId: string;
  amount: number;
  transactionId?: string | null;
  currency: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupContributionPaymentCreationAttributes = Optional<
  GroupContributionPaymentAttributes,
  "id" | "transactionId" | "currency" | "createdAt" | "updatedAt"
>;
