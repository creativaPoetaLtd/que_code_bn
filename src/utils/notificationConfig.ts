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
  
  // System notifications
  ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  
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
    
    // Contact-related data
    contactId?: string;
    contactName?: string;
    
    // General data
    message?: string;
    title?: string;
    description?: string;
    url?: string;
    
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
