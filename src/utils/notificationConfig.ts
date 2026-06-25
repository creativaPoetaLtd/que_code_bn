// Notification configuration for different activities
export enum NotificationType {
  // Group-related notifications
  GROUP_CREATED = "GROUP_CREATED",
  GROUP_INVITATION = "GROUP_INVITATION",
  GROUP_JOINED = "GROUP_JOINED",
  GROUP_MESSAGE = "GROUP_MESSAGE",
  GROUP_JOIN_REQUEST = "GROUP_JOIN_REQUEST",
  GROUP_JOIN_APPROVED = "GROUP_JOIN_APPROVED",
  GROUP_JOIN_REJECTED = "GROUP_JOIN_REJECTED",
  GROUP_LINK_JOIN_REQUEST = "GROUP_LINK_JOIN_REQUEST",
  GROUP_MEMBER_LEFT = "GROUP_MEMBER_LEFT",
  MEMBER_REMOVED_FROM_GROUP = "MEMBER_REMOVED_FROM_GROUP",
  GROUP_DELETED = "GROUP_DELETED",
  GROUP_INVITATION_SENT = "GROUP_INVITATION_SENT",
  GROUP_INVITATION_ACCEPTED = "GROUP_INVITATION_ACCEPTED",
  GROUP_INVITATION_REJECTED = "GROUP_INVITATION_REJECTED",
  GROUP_MEMBER_ADDED = "GROUP_MEMBER_ADDED",
  GROUP_MEMBER_REMOVED = "GROUP_MEMBER_REMOVED",
  GROUP_MEMBER_ROLE_CHANGED = "GROUP_MEMBER_ROLE_CHANGED",
  GROUP_UPDATED = "GROUP_UPDATED",

  // Group contribution notifications
  GROUP_CONTRIBUTION_CREATED = "GROUP_CONTRIBUTION_CREATED",
  GROUP_CONTRIBUTION_RECEIVED = "GROUP_CONTRIBUTION_RECEIVED",
  GROUP_CONTRIBUTION_COMPLETED = "GROUP_CONTRIBUTION_COMPLETED",
  GROUP_CONTRIBUTION_CLOSED = "GROUP_CONTRIBUTION_CLOSED",
  GROUP_CONTRIBUTION_UPDATED = "GROUP_CONTRIBUTION_UPDATED",

  // Public (standalone) contribution notifications
  PUBLIC_CONTRIBUTION_RECEIVED = "PUBLIC_CONTRIBUTION_RECEIVED",
  PUBLIC_CONTRIBUTION_COMPLETED = "PUBLIC_CONTRIBUTION_COMPLETED",
  PUBLIC_CONTRIBUTION_CLOSED = "PUBLIC_CONTRIBUTION_CLOSED",
  
  // Contact-related notifications
  CONTACT_INVITATION_SENT = "CONTACT_INVITATION_SENT",
  CONTACT_REQUEST_RECEIVED = "CONTACT_REQUEST_RECEIVED",
  CONTACT_REQUEST_ACCEPTED = "CONTACT_REQUEST_ACCEPTED",
  CONTACT_REQUEST_REJECTED = "CONTACT_REQUEST_REJECTED",
  CONTACT_ADDED = "CONTACT_ADDED",
  CONTACT_BLOCKED = "CONTACT_BLOCKED",
  CONTACT_UNBLOCKED = "CONTACT_UNBLOCKED",
  CONTACT_REMOVED = "CONTACT_REMOVED",
  
  // Chat-related notifications
  CHAT_MESSAGE_RECEIVED = "CHAT_MESSAGE_RECEIVED",
  CHAT_MESSAGE_TEXT = "CHAT_MESSAGE_TEXT",
  CHAT_MESSAGE_IMAGE = "CHAT_MESSAGE_IMAGE",
  CHAT_MESSAGE_VIDEO = "CHAT_MESSAGE_VIDEO",
  CHAT_MESSAGE_AUDIO = "CHAT_MESSAGE_AUDIO",
  CHAT_MESSAGE_FILE = "CHAT_MESSAGE_FILE",
  CHAT_MESSAGE_MONEY = "CHAT_MESSAGE_MONEY",
  CHAT_MESSAGE_READ = "CHAT_MESSAGE_READ",
  CHAT_DM_CREATED = "CHAT_DM_CREATED",
  CHAT_GROUP_CHAT_CREATED = "CHAT_GROUP_CHAT_CREATED",
  CHAT_DELETED = "CHAT_DELETED",
  CHAT_USER_ADDED = "CHAT_USER_ADDED",
  
  // Transaction-related notifications
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  PAYMENT_SENT = "PAYMENT_SENT",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  TRANSACTION_COMPLETED = "TRANSACTION_COMPLETED",
  TRANSACTION_REFUNDED = "TRANSACTION_REFUNDED",
  TRANSACTION_DISPUTED = "TRANSACTION_DISPUTED",
  LARGE_TRANSACTION_ALERT = "LARGE_TRANSACTION_ALERT",
  PAYMENT_REQUEST_RECEIVED = "PAYMENT_REQUEST_RECEIVED",
  PAYMENT_REQUEST_DECLINED = "PAYMENT_REQUEST_DECLINED",
  PAYMENT_REQUEST_ACCEPTED = "PAYMENT_REQUEST_ACCEPTED",
  
  // Wallet-related notifications
  WALLET_CREATED = "WALLET_CREATED",
  WALLET_RESTRICTION_ADDED = "WALLET_RESTRICTION_ADDED",
  WALLET_RESTRICTION_REMOVED = "WALLET_RESTRICTION_REMOVED",
  LOW_BALANCE_WARNING = "LOW_BALANCE_WARNING",
  
  // Action-related notifications (Tickets, Services, etc.)
  ACTION_CREATED = "ACTION_CREATED",
  ACTION_UPDATED = "ACTION_UPDATED",
  ACTION_DELETED = "ACTION_DELETED",
  ACTION_PURCHASED = "ACTION_PURCHASED",
  ACTION_SOLD = "ACTION_SOLD",
  ACTION_EXPIRED = "ACTION_EXPIRED",
  SUB_ACTION_CREATED = "SUB_ACTION_CREATED",
  SUB_ACTION_UPDATED = "SUB_ACTION_UPDATED",
  
  // Organization-related notifications
  ORGANIZATION_CREATED = "ORGANIZATION_CREATED",
  ORGANIZATION_VERIFIED = "ORGANIZATION_VERIFIED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  ORGANIZATION_DELETED = "ORGANIZATION_DELETED",
  ORGANIZATION_SUSPENDED = "ORGANIZATION_SUSPENDED",
  ORGANIZATION_MEMBER_ADDED = "ORGANIZATION_MEMBER_ADDED",
  ORGANIZATION_MEMBER_REMOVED = "ORGANIZATION_MEMBER_REMOVED",
  ORGANIZATION_ROLE_CHANGED = "ORGANIZATION_ROLE_CHANGED",
  
  // System notifications
  ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  PIN_SET = "PIN_SET",
  PIN_CHANGED = "PIN_CHANGED",
  
  // Admin notifications
  ADMIN_USER_CREATED = "ADMIN_USER_CREATED",
  ADMIN_USER_UPDATED = "ADMIN_USER_UPDATED",
  ADMIN_USER_DELETED = "ADMIN_USER_DELETED",
  ADMIN_STATUS_CHANGED = "ADMIN_STATUS_CHANGED",
  ADMIN_ROLE_ASSIGNED = "ADMIN_ROLE_ASSIGNED",
  ADMIN_ROLE_REMOVED = "ADMIN_ROLE_REMOVED",
  
  // External Account notifications
  EXTERNAL_ACCOUNT_LINKED = "EXTERNAL_ACCOUNT_LINKED",
  EXTERNAL_ACCOUNT_UNLINKED = "EXTERNAL_ACCOUNT_UNLINKED",
  EXTERNAL_ACCOUNT_VERIFIED = "EXTERNAL_ACCOUNT_VERIFIED",
  
  // General notifications
  WELCOME = "WELCOME",
  REMINDER = "REMINDER",
  SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE",
  FEATURE_ANNOUNCEMENT = "FEATURE_ANNOUNCEMENT",
}

export interface NotificationPayload {
  type: NotificationType;
  recipientId: string;
  data: {
    // Group-related data
    groupId?: string;
    groupName?: string;
    requestId?: string;
    
    // User-related data
    userId?: string;
    userName?: string;
    userEmail?: string;
    
    // Chat-related data
    chatId?: string;
    messageId?: string;
    notificationId?: string;
    messageContent?: string;
    messageType?: string;
    senderId?: string;
    senderName?: string;
    chatName?: string;
    isGroupChat?: boolean;
    mediaUrl?: string;
    thumbnailUrl?: string;
    
    // Transaction-related data
    transactionId?: string;
    amount?: number;
    currency?: string;
    transactionType?: string;
    fee?: number;
    
    // Contact-related data
    contactId?: string;
    contactName?: string;
    
    // Action-related data
    actionId?: string;
    actionName?: string;
    actionType?: string;
    actionSlug?: string;
    subActionId?: string;
    subActionName?: string;
    purchaseId?: string;
    ticketNumber?: string;
    expiryDate?: string;
    
    // Organization-related data
    organizationId?: string;
    organizationName?: string;
    organizationType?: string;
    ownerName?: string;
    
    // Wallet-related data
    walletId?: string;
    balance?: number;
    restrictionType?: string;
    thresholdAmount?: number;
    
    // External account data
    externalAccountId?: string;
    externalAccountType?: string;
    externalAccountName?: string;
    
    // Admin action data
    adminId?: string;
    adminName?: string;
    roleId?: string;
    roleName?: string;
    previousStatus?: string;
    newStatus?: string;
    
    // Contribution-related data
    contributionId?: string;
    contributionTitle?: string;

    // General data
    message?: string;
    title?: string;
    description?: string;
    url?: string;
    reason?: string;
    
    // Action buttons
    actions?: {
      type: string;
      label: string;
      url: string;
    }[];
  };
}

// Example config for notification types (can be extended)
const notificationConfig = {
  // Group notifications
  [NotificationType.GROUP_CREATED]: {
    description: "A new group was created",
    priority: "normal",
  },
  [NotificationType.GROUP_INVITATION]: {
    description: "You have been invited to a group",
    priority: "high",
  },
  [NotificationType.GROUP_JOINED]: {
    description: "A user joined your group",
    priority: "normal",
  },
  [NotificationType.GROUP_MESSAGE]: {
    description: "New message in group",
    priority: "normal",
  },
  [NotificationType.GROUP_JOIN_REQUEST]: {
    description: "A user has requested to join your group",
    priority: "high",
  },
  [NotificationType.GROUP_JOIN_APPROVED]: {
    description: "Your group join request has been approved",
    priority: "high",
  },
  [NotificationType.GROUP_JOIN_REJECTED]: {
    description: "Your group join request has been rejected",
    priority: "normal",
  },
  [NotificationType.GROUP_LINK_JOIN_REQUEST]: {
    description: "A user has requested to join via group link/QR code",
    priority: "high",
  },
  [NotificationType.GROUP_MEMBER_LEFT]: {
    description: "A member has left the group",
    priority: "normal",
  },
  [NotificationType.MEMBER_REMOVED_FROM_GROUP]: {
    description: "A member has been removed from the group",
    priority: "normal",
  },
  [NotificationType.GROUP_DELETED]: {
    description: "A group you were in has been deleted",
    priority: "high",
  },
  [NotificationType.GROUP_INVITATION_SENT]: {
    description: "You have sent a group invitation",
    priority: "low",
  },
  [NotificationType.GROUP_INVITATION_ACCEPTED]: {
    description: "Your group invitation was accepted",
    priority: "normal",
  },
  [NotificationType.GROUP_INVITATION_REJECTED]: {
    description: "Your group invitation was rejected",
    priority: "normal",
  },
  [NotificationType.GROUP_MEMBER_ADDED]: {
    description: "You were added to a group",
    priority: "high",
  },
  [NotificationType.GROUP_MEMBER_REMOVED]: {
    description: "You were removed from a group",
    priority: "high",
  },
  [NotificationType.GROUP_MEMBER_ROLE_CHANGED]: {
    description: "Your role in a group has changed",
    priority: "high",
  },
  [NotificationType.GROUP_UPDATED]: {
    description: "A group you're in was updated",
    priority: "normal",
  },
  [NotificationType.GROUP_CONTRIBUTION_CREATED]: {
    description: "A new contribution request has been created in your group",
    priority: "high",
  },
  [NotificationType.GROUP_CONTRIBUTION_RECEIVED]: {
    description: "A member has contributed to the group campaign",
    priority: "normal",
  },
  [NotificationType.GROUP_CONTRIBUTION_COMPLETED]: {
    description: "The group contribution goal has been reached",
    priority: "high",
  },
  [NotificationType.GROUP_CONTRIBUTION_CLOSED]: {
    description: "A group contribution request has been closed",
    priority: "normal",
  },
  [NotificationType.GROUP_CONTRIBUTION_UPDATED]: {
    description: "A group contribution request has been updated",
    priority: "normal",
  },

  // Public contribution notifications
  [NotificationType.PUBLIC_CONTRIBUTION_RECEIVED]: {
    description: "Someone contributed to your campaign",
    priority: "high",
  },
  [NotificationType.PUBLIC_CONTRIBUTION_COMPLETED]: {
    description: "Your contribution campaign has reached its goal",
    priority: "high",
  },
  [NotificationType.PUBLIC_CONTRIBUTION_CLOSED]: {
    description: "A contribution campaign has been closed",
    priority: "normal",
  },

  // Contact notifications
  [NotificationType.CONTACT_INVITATION_SENT]: {
    description: "You have sent a contact invitation",
    priority: "low",
  },
  [NotificationType.CONTACT_REQUEST_RECEIVED]: {
    description: "You have received a contact request",
    priority: "high",
  },
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: {
    description: "Your contact request has been accepted",
    priority: "normal",
  },
  [NotificationType.CONTACT_REQUEST_REJECTED]: {
    description: "Your contact request has been rejected",
    priority: "normal",
  },
  [NotificationType.CONTACT_ADDED]: {
    description: "You have been added as a contact",
    priority: "normal",
  },
  [NotificationType.CONTACT_BLOCKED]: {
    description: "You have been blocked by a contact",
    priority: "normal",
  },
  [NotificationType.CONTACT_UNBLOCKED]: {
    description: "You have been unblocked by a contact",
    priority: "normal",
  },
  [NotificationType.CONTACT_REMOVED]: {
    description: "You have been removed from someone's contacts",
    priority: "normal",
  },
  
  // Chat notifications
  [NotificationType.CHAT_MESSAGE_RECEIVED]: {
    description: "You have received a new message",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_TEXT]: {
    description: "You have received a text message",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_IMAGE]: {
    description: "You have received an image",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_VIDEO]: {
    description: "You have received a video",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_AUDIO]: {
    description: "You have received an audio message",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_FILE]: {
    description: "You have received a file",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_MONEY]: {
    description: "You have received money",
    priority: "high",
  },
  [NotificationType.CHAT_MESSAGE_READ]: {
    description: "Your message has been read",
    priority: "low",
  },
  [NotificationType.CHAT_DM_CREATED]: {
    description: "A new direct message chat has been created",
    priority: "normal",
  },
  [NotificationType.CHAT_GROUP_CHAT_CREATED]: {
    description: "A new group chat has been created",
    priority: "normal",
  },
  [NotificationType.CHAT_DELETED]: {
    description: "A chat has been deleted",
    priority: "normal",
  },
  [NotificationType.CHAT_USER_ADDED]: {
    description: "You have been added to a chat",
    priority: "high",
  },
  
  // Transaction notifications
  [NotificationType.PAYMENT_RECEIVED]: {
    description: "You have received a payment",
    priority: "high",
  },
  [NotificationType.PAYMENT_SENT]: {
    description: "Your payment has been sent",
    priority: "normal",
  },
  [NotificationType.PAYMENT_FAILED]: {
    description: "Your payment has failed",
    priority: "high",
  },
  [NotificationType.PAYMENT_PENDING]: {
    description: "Your payment is pending",
    priority: "normal",
  },
  [NotificationType.TRANSACTION_COMPLETED]: {
    description: "Your transaction has been completed successfully",
    priority: "high",
  },
  [NotificationType.TRANSACTION_REFUNDED]: {
    description: "Your transaction has been refunded",
    priority: "high",
  },
  [NotificationType.TRANSACTION_DISPUTED]: {
    description: "A transaction has been disputed",
    priority: "critical",
  },
  [NotificationType.LARGE_TRANSACTION_ALERT]: {
    description: "Large transaction detected",
    priority: "high",
  },
  [NotificationType.PAYMENT_REQUEST_RECEIVED]: {
    description: "You have received a payment request",
    priority: "high",
  },
  [NotificationType.PAYMENT_REQUEST_DECLINED]: {
    description: "Your payment request was declined",
    priority: "normal",
  },
  [NotificationType.PAYMENT_REQUEST_ACCEPTED]: {
    description: "Your payment request was accepted",
    priority: "high",
  },
  
  // Wallet notifications
  [NotificationType.WALLET_CREATED]: {
    description: "Your wallet has been created",
    priority: "normal",
  },
  [NotificationType.WALLET_RESTRICTION_ADDED]: {
    description: "A restriction has been added to your wallet",
    priority: "high",
  },
  [NotificationType.WALLET_RESTRICTION_REMOVED]: {
    description: "A restriction has been removed from your wallet",
    priority: "normal",
  },
  [NotificationType.LOW_BALANCE_WARNING]: {
    description: "Your wallet balance is low",
    priority: "normal",
  },
  
  // Action notifications (Tickets, Services, etc.)
  [NotificationType.ACTION_CREATED]: {
    description: "A new action has been created",
    priority: "normal",
  },
  [NotificationType.ACTION_UPDATED]: {
    description: "An action has been updated",
    priority: "normal",
  },
  [NotificationType.ACTION_DELETED]: {
    description: "An action has been deleted",
    priority: "normal",
  },
  [NotificationType.ACTION_PURCHASED]: {
    description: "You have purchased an action",
    priority: "high",
  },
  [NotificationType.ACTION_SOLD]: {
    description: "Your action has been sold",
    priority: "high",
  },
  [NotificationType.ACTION_EXPIRED]: {
    description: "An action has expired",
    priority: "normal",
  },
  [NotificationType.SUB_ACTION_CREATED]: {
    description: "A new sub-action has been created",
    priority: "normal",
  },
  [NotificationType.SUB_ACTION_UPDATED]: {
    description: "A sub-action has been updated",
    priority: "normal",
  },
  
  // Organization notifications
  [NotificationType.ORGANIZATION_CREATED]: {
    description: "A new organization has been created",
    priority: "normal",
  },
  [NotificationType.ORGANIZATION_VERIFIED]: {
    description: "Your organization has been verified",
    priority: "high",
  },
  [NotificationType.ORGANIZATION_UPDATED]: {
    description: "Organization details have been updated",
    priority: "normal",
  },
  [NotificationType.ORGANIZATION_DELETED]: {
    description: "An organization has been deleted",
    priority: "high",
  },
  [NotificationType.ORGANIZATION_SUSPENDED]: {
    description: "An organization has been suspended",
    priority: "critical",
  },
  [NotificationType.ORGANIZATION_MEMBER_ADDED]: {
    description: "You have been added to an organization",
    priority: "high",
  },
  [NotificationType.ORGANIZATION_MEMBER_REMOVED]: {
    description: "You have been removed from an organization",
    priority: "high",
  },
  [NotificationType.ORGANIZATION_ROLE_CHANGED]: {
    description: "Your role in an organization has changed",
    priority: "high",
  },
  
  // System notifications
  [NotificationType.ACCOUNT_VERIFIED]: {
    description: "Your account has been verified",
    priority: "high",
  },
  [NotificationType.ACCOUNT_SUSPENDED]: {
    description: "Your account has been suspended",
    priority: "critical",
  },
  [NotificationType.PASSWORD_CHANGED]: {
    description: "Your password has been changed",
    priority: "high",
  },
  [NotificationType.PROFILE_UPDATED]: {
    description: "Your profile has been updated",
    priority: "low",
  },
  [NotificationType.PIN_SET]: {
    description: "Your PIN has been set successfully",
    priority: "normal",
  },
  [NotificationType.PIN_CHANGED]: {
    description: "Your PIN has been changed",
    priority: "high",
  },
  
  // Admin notifications
  [NotificationType.ADMIN_USER_CREATED]: {
    description: "An admin has created your account",
    priority: "high",
  },
  [NotificationType.ADMIN_USER_UPDATED]: {
    description: "An admin has updated your account",
    priority: "normal",
  },
  [NotificationType.ADMIN_USER_DELETED]: {
    description: "Your account has been deleted by an admin",
    priority: "critical",
  },
  [NotificationType.ADMIN_STATUS_CHANGED]: {
    description: "An admin has changed your account status",
    priority: "high",
  },
  [NotificationType.ADMIN_ROLE_ASSIGNED]: {
    description: "An admin has assigned you a new role",
    priority: "high",
  },
  [NotificationType.ADMIN_ROLE_REMOVED]: {
    description: "An admin has removed one of your roles",
    priority: "high",
  },
  
  // External account notifications
  [NotificationType.EXTERNAL_ACCOUNT_LINKED]: {
    description: "An external account has been linked",
    priority: "normal",
  },
  [NotificationType.EXTERNAL_ACCOUNT_UNLINKED]: {
    description: "An external account has been unlinked",
    priority: "normal",
  },
  [NotificationType.EXTERNAL_ACCOUNT_VERIFIED]: {
    description: "Your external account has been verified",
    priority: "normal",
  },
  
  // General notifications
  [NotificationType.WELCOME]: {
    description: "Welcome to the platform",
    priority: "normal",
  },
  [NotificationType.REMINDER]: {
    description: "Reminder notification",
    priority: "normal",
  },
  [NotificationType.SYSTEM_MAINTENANCE]: {
    description: "System maintenance notification",
    priority: "high",
  },
  [NotificationType.FEATURE_ANNOUNCEMENT]: {
    description: "New feature announcement",
    priority: "low",
  },
};

export default notificationConfig;
