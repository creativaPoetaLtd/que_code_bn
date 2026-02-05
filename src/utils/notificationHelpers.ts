import { Application } from "express";
import { createAndSendNotification } from "./notificationService";
import { NotificationType } from "./notificationConfig";

/**
 * Helper functions for creating specific types of notifications
 */

// Group-related notification helpers
export const notifyGroupCreated = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  creatorName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_CREATED,
    recipientId,
    data: {
      groupId,
      groupName,
      userName: creatorName,
      title: "New Group Created",
      message: `${creatorName} created a new group: ${groupName}`,
    },
  });
};

export const notifyGroupInvitation = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  inviterName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_INVITATION,
    recipientId,
    data: {
      groupId,
      groupName,
      userName: inviterName,
      title: "Group Invitation",
      message: `${inviterName} invited you to join ${groupName}`,
      actions: [
        {
          type: "accept",
          label: "Accept",
          url: `/groups/${groupId}/accept-invitation`,
        },
        {
          type: "reject",
          label: "Reject",
          url: `/groups/${groupId}/reject-invitation`,
        },
      ],
    },
  });
};

export const notifyGroupJoinRequest = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  requesterName: string,
  requestId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_JOIN_REQUEST,
    recipientId,
    data: {
      groupId,
      groupName,
      userName: requesterName,
      requestId,
      title: "Group Join Request",
      message: `${requesterName} wants to join ${groupName}`,
      actions: [
        {
          type: "approve",
          label: "Approve",
          url: `/groups/${groupId}/requests/${requestId}/approve`,
        },
        {
          type: "reject",
          label: "Reject",
          url: `/groups/${groupId}/requests/${requestId}/reject`,
        },
      ],
    },
  });
};

// Contact-related notification helpers
export const notifyContactRequest = async (
  app: Application,
  recipientId: string,
  requesterId: string,
  requesterName: string,
  contactId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_REQUEST_RECEIVED,
    recipientId,
    data: {
      userId: requesterId,
      userName: requesterName,
      contactId,
      title: "Contact Request",
      message: `${requesterName} sent you a contact request`,
      actions: [
        {
          type: "accept",
          label: "Accept",
          url: `/contacts/${contactId}/accept`,
        },
        {
          type: "reject",
          label: "Reject",
          url: `/contacts/${contactId}/reject`,
        },
      ],
    },
  });
};

export const notifyContactAdded = async (
  app: Application,
  recipientId: string,
  userId: string,
  userName: string,
  contactId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_ADDED,
    recipientId,
    data: {
      userId,
      userName,
      contactId,
      title: "New Contact Added",
      message: `${userName} is now in your contacts`,
      url: `/contacts/${contactId}`,
    },
  });
};

export const notifyContactBlocked = async (
  app: Application,
  recipientId: string,
  userId: string,
  userName: string,
  contactId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_BLOCKED,
    recipientId,
    data: {
      userId,
      userName,
      contactId,
      title: "Contact Blocked",
      message: `${userName} has blocked you`,
    },
  });
};

export const notifyContactUnblocked = async (
  app: Application,
  recipientId: string,
  userId: string,
  userName: string,
  contactId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_UNBLOCKED,
    recipientId,
    data: {
      userId,
      userName,
      contactId,
      title: "Contact Unblocked",
      message: `${userName} has unblocked you`,
      url: `/contacts/${contactId}`,
    },
  });
};

export const notifyContactRemoved = async (
  app: Application,
  recipientId: string,
  userId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_REMOVED,
    recipientId,
    data: {
      userId,
      userName,
      title: "Contact Removed",
      message: `${userName} has removed you from their contacts`,
    },
  });
};

// Transaction-related notification helpers
export const notifyPaymentReceived = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  senderName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_RECEIVED,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      userName: senderName,
      title: "Payment Received",
      message: `You received ${amount} ${currency} from ${senderName}`,
      url: `/transactions/${transactionId}`,
    },
  });
};

export const notifyPaymentSent = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  receiverName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_SENT,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      userName: receiverName,
      title: "Payment Sent",
      message: `You sent ${amount} ${currency} to ${receiverName}`,
      url: `/transactions/${transactionId}`,
    },
  });
};

export const notifyPaymentFailed = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  reason: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_FAILED,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      title: "Payment Failed",
      message: `Your payment of ${amount} ${currency} failed: ${reason}`,
      url: `/transactions/${transactionId}`,
      actions: [
        {
          type: "retry",
          label: "Retry Payment",
          url: `/transactions/${transactionId}/retry`,
        },
      ],
    },
  });
};

// System notification helpers
export const notifyAccountVerified = async (
  app: Application,
  recipientId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACCOUNT_VERIFIED,
    recipientId,
    data: {
      userName,
      title: "Account Verified",
      message: "Your account has been successfully verified!",
      url: "/profile",
    },
  });
};

export const notifyWelcome = async (
  app: Application,
  recipientId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.WELCOME,
    recipientId,
    data: {
      userName,
      title: "Welcome to QueCode!",
      message: `Welcome ${userName}! Thank you for joining our platform.`,
      url: "/getting-started",
    },
  });
};

// Bulk notification helpers
export const notifySystemMaintenance = async (
  app: Application,
  userIds: string[],
  maintenanceDate: Date,
  duration: string
) => {
  const notifications = userIds.map((userId) => 
    createAndSendNotification(app, {
      type: NotificationType.SYSTEM_MAINTENANCE,
      recipientId: userId,
      data: {
        title: "Scheduled Maintenance",
        message: `System maintenance scheduled for ${maintenanceDate.toLocaleDateString()} (${duration})`,
        description: "Our platform will be temporarily unavailable during this time.",
      },
    })
  );
  
  return Promise.all(notifications);
};

// Chat notification helpers
export const notifyChatMessageReceived = async (
  app: Application,
  recipientId: string,
  chatId: string,
  messageId: string,
  senderId: string,
  senderName: string,
  messageContent: string,
  messageType: string = "text",
  isGroupChat: boolean = false,
  chatName?: string,
  mediaUrl?: string,
  thumbnailUrl?: string
) => {
  // Determine notification type based on message type
  const notificationTypeMap: Record<string, NotificationType> = {
    text: NotificationType.CHAT_MESSAGE_TEXT,
    image: NotificationType.CHAT_MESSAGE_IMAGE,
    video: NotificationType.CHAT_MESSAGE_VIDEO,
    audio: NotificationType.CHAT_MESSAGE_AUDIO,
    file: NotificationType.CHAT_MESSAGE_FILE,
    document: NotificationType.CHAT_MESSAGE_FILE,
    money: NotificationType.CHAT_MESSAGE_MONEY,
  };

  const notificationType = notificationTypeMap[messageType] || NotificationType.CHAT_MESSAGE_RECEIVED;

  // Create message preview based on type
  let messagePreview = messageContent;
  const messageTypeLabels: Record<string, string> = {
    image: "📷 Photo",
    video: "🎥 Video",
    audio: "🎤 Audio",
    file: "📎 File",
    document: "📄 Document",
    money: "💰 Money transfer",
  };

  if (messageType !== "text" && messageType in messageTypeLabels) {
    messagePreview = messageTypeLabels[messageType];
  } else if (messageContent.length > 100) {
    messagePreview = messageContent.substring(0, 100) + "...";
  }

  const title = isGroupChat 
    ? `New message in ${chatName || "group chat"}`
    : `New message from ${senderName}`;

  const message = isGroupChat
    ? `${senderName}: ${messagePreview}`
    : messagePreview;

  return createAndSendNotification(app, {
    type: notificationType,
    recipientId,
    data: {
      chatId,
      messageId,
      senderId,
      senderName,
      messageContent: messagePreview,
      messageType,
      isGroupChat,
      chatName,
      mediaUrl,
      thumbnailUrl,
      title,
      message,
      url: `/chat?chatId=${chatId}`,
      actions: [
        {
          type: "view",
          label: "View Message",
          url: `/chat?chatId=${chatId}`,
        },
        {
          type: "reply",
          label: "Reply",
          url: `/chat?chatId=${chatId}`,
        },
      ],
    },
  });
};

export const notifyChatMessagesRead = async (
  app: Application,
  recipientId: string,
  chatId: string,
  readByUserId: string,
  readByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CHAT_MESSAGE_READ,
    recipientId,
    data: {
      chatId,
      userId: readByUserId,
      userName: readByUserName,
      title: "Message Read",
      message: `${readByUserName} read your message`,
      url: `/chat?chatId=${chatId}`,
    },
  });
};

export const notifyChatDMCreated = async (
  app: Application,
  recipientId: string,
  chatId: string,
  initiatorId: string,
  initiatorName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CHAT_DM_CREATED,
    recipientId,
    data: {
      chatId,
      userId: initiatorId,
      userName: initiatorName,
      title: "New Direct Message",
      message: `${initiatorName} started a conversation with you`,
      url: `/chat?chatId=${chatId}`,
      actions: [
        {
          type: "view",
          label: "View Chat",
          url: `/chat?chatId=${chatId}`,
        },
      ],
    },
  });
};

export const notifyChatGroupChatCreated = async (
  app: Application,
  recipientId: string,
  chatId: string,
  groupId: string,
  groupName: string,
  creatorId: string,
  creatorName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CHAT_GROUP_CHAT_CREATED,
    recipientId,
    data: {
      chatId,
      groupId,
      groupName,
      userId: creatorId,
      userName: creatorName,
      title: "New Group Chat",
      message: `${creatorName} created a group chat: ${groupName}`,
      url: `/chat?chatId=${chatId}`,
      actions: [
        {
          type: "view",
          label: "View Group Chat",
          url: `/chat?chatId=${chatId}`,
        },
      ],
    },
  });
};

export const notifyChatUserAdded = async (
  app: Application,
  recipientId: string,
  chatId: string,
  groupName: string,
  addedByUserId: string,
  addedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CHAT_USER_ADDED,
    recipientId,
    data: {
      chatId,
      groupName,
      userId: addedByUserId,
      userName: addedByUserName,
      title: "Added to Group Chat",
      message: `${addedByUserName} added you to ${groupName}`,
      url: `/chat?chatId=${chatId}`,
      actions: [
        {
          type: "view",
          label: "View Chat",
          url: `/chat?chatId=${chatId}`,
        },
      ],
    },
  });
};

export const notifyChatDeleted = async (
  app: Application,
  recipientId: string,
  chatId: string,
  chatName: string,
  deletedByUserId: string,
  deletedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CHAT_DELETED,
    recipientId,
    data: {
      chatId,
      chatName,
      userId: deletedByUserId,
      userName: deletedByUserName,
      title: "Chat Deleted",
      message: `${deletedByUserName} deleted the chat: ${chatName}`,
    },
  });
};

export const notifyFeatureAnnouncement = async (
  app: Application,
  userIds: string[],
  featureName: string,
  description: string,
  learnMoreUrl?: string
) => {
  const notifications = userIds.map((userId) => 
    createAndSendNotification(app, {
      type: NotificationType.FEATURE_ANNOUNCEMENT,
      recipientId: userId,
      data: {
        title: `New Feature: ${featureName}`,
        message: description,
        url: learnMoreUrl,
        actions: learnMoreUrl ? [
          {
            type: "learn_more",
            label: "Learn More",
            url: learnMoreUrl,
          },
        ] : undefined,
      },
    })
  );
  
  return Promise.all(notifications);
};

// ===========================
// CONTACT NOTIFICATION HELPERS
// ===========================

/**
 * Notify when a contact invitation is sent
 */
export const notifyContactInvitationSent = async (
  app: Application,
  recipientId: string,
  inviteeId: string,
  inviteeName: string,
  inviteeEmail: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_INVITATION_SENT,
    recipientId,
    data: {
      userId: inviteeId,
      userName: inviteeName,
      userEmail: inviteeEmail,
      title: "Contact Invitation Sent",
      message: `Your invitation to ${inviteeName} has been sent`,
    },
  });
};

/**
 * Notify when a contact request is accepted
 */
export const notifyContactRequestAccepted = async (
  app: Application,
  recipientId: string,
  accepterId: string,
  accepterName: string,
  contactId: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_REQUEST_ACCEPTED,
    recipientId,
    data: {
      userId: accepterId,
      userName: accepterName,
      contactId,
      title: "Contact Request Accepted",
      message: `${accepterName} accepted your contact request`,
      url: `/contacts/${contactId}`,
      actions: [
        {
          type: "message",
          label: "Send Message",
          url: `/chat?contactId=${contactId}`,
        },
      ],
    },
  });
};

/**
 * Notify when a contact request is rejected
 */
export const notifyContactRequestRejected = async (
  app: Application,
  recipientId: string,
  rejecterId: string,
  rejecterName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.CONTACT_REQUEST_REJECTED,
    recipientId,
    data: {
      userId: rejecterId,
      userName: rejecterName,
      title: "Contact Request Declined",
      message: `${rejecterName} declined your contact request`,
    },
  });
};

// ===========================
// GROUP NOTIFICATION HELPERS
// ===========================

/**
 * Notify when a group invitation is accepted
 */
export const notifyGroupInvitationAccepted = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  accepterId: string,
  accepterName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_INVITATION_ACCEPTED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: accepterId,
      userName: accepterName,
      title: "Group Invitation Accepted",
      message: `${accepterName} accepted your invitation to ${groupName}`,
      url: `/groups/${groupId}`,
    },
  });
};

/**
 * Notify when a group invitation is rejected
 */
export const notifyGroupInvitationRejected = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  rejecterId: string,
  rejecterName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_INVITATION_REJECTED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: rejecterId,
      userName: rejecterName,
      title: "Group Invitation Declined",
      message: `${rejecterName} declined your invitation to ${groupName}`,
      url: `/groups/${groupId}`,
    },
  });
};

/**
 * Notify when a user is added to a group
 */
export const notifyGroupMemberAdded = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  addedByUserId: string,
  addedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_MEMBER_ADDED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: addedByUserId,
      userName: addedByUserName,
      title: "Added to Group",
      message: `${addedByUserName} added you to ${groupName}`,
      url: `/groups/${groupId}`,
      actions: [
        {
          type: "view",
          label: "View Group",
          url: `/groups/${groupId}`,
        },
      ],
    },
  });
};

/**
 * Notify when a user is removed from a group
 */
export const notifyGroupMemberRemoved = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  removedByUserId: string,
  removedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_MEMBER_REMOVED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: removedByUserId,
      userName: removedByUserName,
      title: "Removed from Group",
      message: `${removedByUserName} removed you from ${groupName}`,
    },
  });
};

/**
 * Notify when a user's role in a group changes
 */
export const notifyGroupMemberRoleChanged = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  newRole: string,
  changedByUserId: string,
  changedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_MEMBER_ROLE_CHANGED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: changedByUserId,
      userName: changedByUserName,
      title: "Role Changed",
      message: `${changedByUserName} changed your role to ${newRole} in ${groupName}`,
      url: `/groups/${groupId}`,
    },
  });
};

/**
 * Notify when a user leaves a group
 */
export const notifyGroupMemberLeft = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  userId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_MEMBER_LEFT,
    recipientId,
    data: {
      groupId,
      groupName,
      userId,
      userName,
      title: "Member Left Group",
      message: `${userName} left ${groupName}`,
      url: `/groups/${groupId}`,
    },
  });
};

/**
 * Notify when a group is updated
 */
export const notifyGroupUpdated = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  updatedByUserId: string,
  updatedByUserName: string,
  updateDescription: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_UPDATED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: updatedByUserId,
      userName: updatedByUserName,
      title: "Group Updated",
      message: `${updatedByUserName} updated ${groupName}: ${updateDescription}`,
      url: `/groups/${groupId}`,
    },
  });
};

/**
 * Notify when a group is deleted
 */
export const notifyGroupDeleted = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  deletedByUserId: string,
  deletedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_DELETED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: deletedByUserId,
      userName: deletedByUserName,
      title: "Group Deleted",
      message: `${deletedByUserName} deleted the group ${groupName}`,
    },
  });
};

/**
 * Notify admins when a join request is approved
 */
export const notifyGroupJoinApproved = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  approvedByUserId: string,
  approvedByUserName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_JOIN_APPROVED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: approvedByUserId,
      userName: approvedByUserName,
      title: "Join Request Approved",
      message: `Your request to join ${groupName} has been approved`,
      url: `/groups/${groupId}`,
      actions: [
        {
          type: "view",
          label: "View Group",
          url: `/groups/${groupId}`,
        },
      ],
    },
  });
};

/**
 * Notify when a join request is rejected
 */
export const notifyGroupJoinRejected = async (
  app: Application,
  recipientId: string,
  groupId: string,
  groupName: string,
  rejectedByUserId: string,
  rejectedByUserName: string,
  rejectionReason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.GROUP_JOIN_REJECTED,
    recipientId,
    data: {
      groupId,
      groupName,
      userId: rejectedByUserId,
      userName: rejectedByUserName,
      title: "Join Request Declined",
      message: rejectionReason 
        ? `Your request to join ${groupName} was declined: ${rejectionReason}`
        : `Your request to join ${groupName} was declined`,
      description: rejectionReason,
    },
  });
};
