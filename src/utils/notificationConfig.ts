// Notification configuration for different activities
export enum NotificationType {
  GROUP_CREATED = "GROUP_CREATED",
  GROUP_INVITATION = "GROUP_INVITATION",
  GROUP_JOINED = "GROUP_JOINGROUP_INVITATION_SENTED",
  GROUP_MESSAGE = "GROUP_MESSAGE",
  GROUP_JOIN_REQUEST = "GROUP_JOIN_REQUEST",
  GROUP_JOIN_APPROVED = "GROUP_JOIN_APPROVED",
  GROUP_JOIN_REJECTED = "GROUP_JOIN_REJECTED",
  GROUP_LINK_JOIN_REQUEST = "GROUP_LINK_JOIN_REQUEST",
  GROUP_MEMBER_LEFT = "GROUP_MEMBER_LEFT",
  MEMBER_REMOVED_FROM_GROUP = "MEMBER_REMOVED_FROM_GROUP",
  GROUP_DELETED = "GROUP_DELETED",
  GROUP_INVITATION_SENT = "GROUP_INVITATION_SENT",
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
  [NotificationType.GROUP_MEMBER_LEFT]: {
    description: "A member has left the group",
  },
  [NotificationType.MEMBER_REMOVED_FROM_GROUP]: {
    description: "A member has been removed from the group",
  },
  [NotificationType.GROUP_DELETED]: {
    description: "A group you were in has been deleted",
  },
  [NotificationType.GROUP_INVITATION_SENT]: {
    description: "You have sent a group invitation",
  },
};

export default notificationConfig;
