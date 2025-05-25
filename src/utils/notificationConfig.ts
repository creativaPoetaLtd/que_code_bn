// Notification configuration for different activities
export enum NotificationType {
  GROUP_CREATED = "GROUP_CREATED",
  GROUP_INVITATION = "GROUP_INVITATION",
  GROUP_JOINED = "GROUP_JOINED",
  GROUP_MESSAGE = "GROUP_MESSAGE",
  GROUP_JOIN_REQUEST = "GROUP_JOIN_REQUEST",
  GROUP_JOIN_APPROVED = "GROUP_JOIN_APPROVED",
  GROUP_JOIN_REJECTED = "GROUP_JOIN_REJECTED",
  GROUP_LINK_JOIN_REQUEST = "GROUP_LINK_JOIN_REQUEST"
  // Add more as needed
}

export interface NotificationPayload {
  type: NotificationType;
  recipientId: string;
  data: {
    groupId?: string;
    groupName?: string;
    requestId?: string;
    userId?: string;
    userName?: string;
    message?: string;
    actions?: {
      type: string;
      label: string;
      url: string;
    }[];
  };
}

// Example config for notification types (can be extended)
const notificationConfig = {
  [NotificationType.GROUP_CREATED]: {
    description: "A new group was created",
  },
  [NotificationType.GROUP_INVITATION]: {
    description: "You have been invited to a group",
  },
  [NotificationType.GROUP_JOINED]: {
    description: "A user joined your group",
  },
  [NotificationType.GROUP_MESSAGE]: {
    description: "New message in group",
  },
  [NotificationType.GROUP_JOIN_REQUEST]: {
    description: "A user has requested to join your group",
  },
  [NotificationType.GROUP_JOIN_APPROVED]: {
    description: "Your group join request has been approved",
  },
  [NotificationType.GROUP_JOIN_REJECTED]: {
    description: "Your group join request has been rejected",
  },
  [NotificationType.GROUP_LINK_JOIN_REQUEST]: {
    description: "A user has requested to join via group link/QR code",
  },
};

export default notificationConfig;
