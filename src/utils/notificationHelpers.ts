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

export const notifyPaymentRequestReceived = async (
  app: Application,
  recipientId: string,
  requestId: string,
  amount: number,
  currency: string,
  senderName: string,
  note?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_REQUEST_RECEIVED,
    recipientId,
    data: {
      userId: requestId, // Using requestId as identifier in data
      requestId,
      amount,
      currency,
      userName: senderName,
      title: "Payment Request",
      message: `${senderName} requested ${amount} ${currency}${note ? `: ${note}` : ""}`,
      url: `/home/requests`, // Corrected path for money requests
      actions: [
        {
          type: "pay",
          label: "Pay Now",
          url: `/home/transfer/amount?requestId=${requestId}`,
        },
      ],
    },
  });
};

export const notifyPaymentRequestDeclined = async (
  app: Application,
  recipientId: string,
  requestId: string,
  amount: number,
  currency: string,
  declinedByName: string,
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_REQUEST_DECLINED,
    recipientId,
    data: {
      requestId,
      amount,
      currency,
      userName: declinedByName,
      title: "Payment Request Declined",
      message: `${declinedByName} declined your payment request of ${amount} ${currency}`,
      url: `/home/requests`,
    },
  });
};

export const notifyPaymentRequestAccepted = async (
  app: Application,
  recipientId: string,
  requestId: string,
  amount: number,
  currency: string,
  acceptedByName: string,
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PAYMENT_REQUEST_ACCEPTED,
    recipientId,
    data: {
      requestId,
      amount,
      currency,
      userName: acceptedByName,
      title: "Payment Request Accepted",
      message: `${acceptedByName} paid your request of ${amount} ${currency}`,
      url: `/home/requests`,
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

// ===========================
// TRANSACTION NOTIFICATION HELPERS
// ===========================

/**
 * Notify when a transaction is completed
 */
export const notifyTransactionCompleted = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  transactionType: string,
  otherPartyName?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.TRANSACTION_COMPLETED,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      transactionType,
      userName: otherPartyName,
      title: "Transaction Completed",
      message: otherPartyName 
        ? `Your ${transactionType} of ${amount} ${currency} with ${otherPartyName} is complete`
        : `Your ${transactionType} of ${amount} ${currency} is complete`,
      url: `/transactions/${transactionId}`,
    },
  });
};

/**
 * Notify when a transaction is refunded
 */
export const notifyTransactionRefunded = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.TRANSACTION_REFUNDED,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      reason,
      title: "Transaction Refunded",
      message: reason
        ? `Your transaction of ${amount} ${currency} has been refunded: ${reason}`
        : `Your transaction of ${amount} ${currency} has been refunded`,
      url: `/transactions/${transactionId}`,
    },
  });
};

/**
 * Notify when a transaction is disputed
 */
export const notifyTransactionDisputed = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  disputedByName: string,
  disputeReason: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.TRANSACTION_DISPUTED,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      userName: disputedByName,
      reason: disputeReason,
      title: "Transaction Disputed",
      message: `${disputedByName} has disputed a transaction of ${amount} ${currency}: ${disputeReason}`,
      url: `/transactions/${transactionId}`,
      actions: [
        {
          type: "view",
          label: "View Details",
          url: `/transactions/${transactionId}/dispute`,
        },
        {
          type: "respond",
          label: "Respond",
          url: `/transactions/${transactionId}/dispute/respond`,
        },
      ],
    },
  });
};

/**
 * Notify for large transaction alerts
 */
export const notifyLargeTransaction = async (
  app: Application,
  recipientId: string,
  transactionId: string,
  amount: number,
  currency: string,
  transactionType: string,
  thresholdAmount: number
) => {
  return createAndSendNotification(app, {
    type: NotificationType.LARGE_TRANSACTION_ALERT,
    recipientId,
    data: {
      transactionId,
      amount,
      currency,
      transactionType,
      thresholdAmount,
      title: "Large Transaction Alert",
      message: `Large ${transactionType} detected: ${amount} ${currency} (threshold: ${thresholdAmount})`,
      url: `/transactions/${transactionId}`,
      actions: [
        {
          type: "view",
          label: "View Transaction",
          url: `/transactions/${transactionId}`,
        },
      ],
    },
  });
};

// ===========================
// WALLET NOTIFICATION HELPERS
// ===========================

/**
 * Notify when a wallet is created
 */
export const notifyWalletCreated = async (
  app: Application,
  recipientId: string,
  walletId: string,
  currency: string = "RWF"
) => {
  return createAndSendNotification(app, {
    type: NotificationType.WALLET_CREATED,
    recipientId,
    data: {
      walletId,
      currency,
      title: "Wallet Created",
      message: `Your ${currency} wallet has been created successfully`,
      url: `/wallet`,
    },
  });
};

/**
 * Notify when a wallet restriction is added
 */
export const notifyWalletRestrictionAdded = async (
  app: Application,
  recipientId: string,
  walletId: string,
  restrictionType: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.WALLET_RESTRICTION_ADDED,
    recipientId,
    data: {
      walletId,
      restrictionType,
      reason,
      title: "Wallet Restriction Added",
      message: reason 
        ? `A ${restrictionType} restriction has been added to your wallet: ${reason}`
        : `A ${restrictionType} restriction has been added to your wallet`,
      url: `/wallet/restrictions`,
    },
  });
};

/**
 * Notify when a wallet restriction is removed
 */
export const notifyWalletRestrictionRemoved = async (
  app: Application,
  recipientId: string,
  walletId: string,
  restrictionType: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.WALLET_RESTRICTION_REMOVED,
    recipientId,
    data: {
      walletId,
      restrictionType,
      title: "Wallet Restriction Removed",
      message: `The ${restrictionType} restriction has been removed from your wallet`,
      url: `/wallet`,
    },
  });
};

/**
 * Notify for low balance warning
 */
export const notifyLowBalance = async (
  app: Application,
  recipientId: string,
  walletId: string,
  balance: number,
  currency: string,
  thresholdAmount: number
) => {
  return createAndSendNotification(app, {
    type: NotificationType.LOW_BALANCE_WARNING,
    recipientId,
    data: {
      walletId,
      balance,
      currency,
      thresholdAmount,
      title: "Low Balance Warning",
      message: `Your wallet balance is low: ${balance} ${currency} (threshold: ${thresholdAmount})`,
      url: `/wallet`,
      actions: [
        {
          type: "fund",
          label: "Add Funds",
          url: `/wallet/fund`,
        },
      ],
    },
  });
};

// ===========================
// ACTION NOTIFICATION HELPERS (Tickets, Services, etc.)
// ===========================

/**
 * Notify when an action is created
 */
export const notifyActionCreated = async (
  app: Application,
  recipientId: string,
  actionId: string,
  actionName: string,
  actionType: string,
  organizationName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_CREATED,
    recipientId,
    data: {
      actionId,
      actionName,
      actionType,
      organizationName,
      title: "New Action Available",
      message: `${organizationName} created a new ${actionType}: ${actionName}`,
      url: `/actions/${actionId}`,
      actions: [
        {
          type: "view",
          label: "View Details",
          url: `/actions/${actionId}`,
        },
      ],
    },
  });
};

/**
 * Notify when an action is updated
 */
export const notifyActionUpdated = async (
  app: Application,
  recipientId: string,
  actionId: string,
  actionName: string,
  actionType: string,
  updateDescription: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_UPDATED,
    recipientId,
    data: {
      actionId,
      actionName,
      actionType,
      description: updateDescription,
      title: "Action Updated",
      message: `${actionName} has been updated: ${updateDescription}`,
      url: `/actions/${actionId}`,
    },
  });
};

/**
 * Notify when an action is deleted
 */
export const notifyActionDeleted = async (
  app: Application,
  recipientId: string,
  actionName: string,
  actionType: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_DELETED,
    recipientId,
    data: {
      actionName,
      actionType,
      reason,
      title: "Action Deleted",
      message: reason
        ? `${actionName} (${actionType}) has been deleted: ${reason}`
        : `${actionName} (${actionType}) has been deleted`,
    },
  });
};

/**
 * Notify when an action is purchased
 */
export const notifyActionPurchased = async (
  app: Application,
  recipientId: string,
  purchaseId: string,
  actionId: string,
  actionName: string,
  actionType: string,
  amount: number,
  currency: string,
  ticketNumber?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_PURCHASED,
    recipientId,
    data: {
      purchaseId,
      actionId,
      actionName,
      actionType,
      amount,
      currency,
      ticketNumber,
      title: "Purchase Confirmed",
      message: `You purchased ${actionName} for ${amount} ${currency}${ticketNumber ? `. Ticket: ${ticketNumber}` : ''}`,
      url: `/purchases/${purchaseId}`,
      actions: [
        {
          type: "view",
          label: "View Ticket",
          url: `/purchases/${purchaseId}`,
        },
      ],
    },
  });
};

/**
 * Notify organization when an action is sold
 */
export const notifyActionSold = async (
  app: Application,
  recipientId: string,
  purchaseId: string,
  actionId: string,
  actionName: string,
  buyerName: string,
  amount: number,
  currency: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_SOLD,
    recipientId,
    data: {
      purchaseId,
      actionId,
      actionName,
      userName: buyerName,
      amount,
      currency,
      title: "Action Sold",
      message: `${buyerName} purchased ${actionName} for ${amount} ${currency}`,
      url: `/sales/${purchaseId}`,
      actions: [
        {
          type: "view",
          label: "View Sale",
          url: `/sales/${purchaseId}`,
        },
      ],
    },
  });
};

/**
 * Notify when an action expires
 */
export const notifyActionExpired = async (
  app: Application,
  recipientId: string,
  actionId: string,
  actionName: string,
  actionType: string,
  expiryDate: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ACTION_EXPIRED,
    recipientId,
    data: {
      actionId,
      actionName,
      actionType,
      expiryDate,
      title: "Action Expired",
      message: `${actionName} expired on ${expiryDate}`,
    },
  });
};

/**
 * Notify when a sub-action is created
 */
export const notifySubActionCreated = async (
  app: Application,
  recipientId: string,
  subActionId: string,
  subActionName: string,
  actionId: string,
  actionName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.SUB_ACTION_CREATED,
    recipientId,
    data: {
      subActionId,
      subActionName,
      actionId,
      actionName,
      title: "New Sub-Action Available",
      message: `A new option "${subActionName}" is now available for ${actionName}`,
      url: `/actions/${actionId}`,
    },
  });
};

/**
 * Notify when a sub-action is updated
 */
export const notifySubActionUpdated = async (
  app: Application,
  recipientId: string,
  subActionId: string,
  subActionName: string,
  actionId: string,
  actionName: string,
  updateDescription: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.SUB_ACTION_UPDATED,
    recipientId,
    data: {
      subActionId,
      subActionName,
      actionId,
      actionName,
      description: updateDescription,
      title: "Sub-Action Updated",
      message: `"${subActionName}" for ${actionName} has been updated: ${updateDescription}`,
      url: `/actions/${actionId}`,
    },
  });
};

// ===========================
// ORGANIZATION NOTIFICATION HELPERS
// ===========================

/**
 * Notify when an organization is created
 */
export const notifyOrganizationCreated = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string,
  ownerName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_CREATED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      ownerName,
      title: "Organization Created",
      message: `Your organization "${organizationName}" has been created successfully`,
      url: `/organizations/${organizationId}`,
      actions: [
        {
          type: "view",
          label: "View Organization",
          url: `/organizations/${organizationId}`,
        },
        {
          type: "setup",
          label: "Complete Setup",
          url: `/organizations/${organizationId}/setup`,
        },
      ],
    },
  });
};

/**
 * Notify when an organization is verified
 */
export const notifyOrganizationVerified = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_VERIFIED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      title: "Organization Verified",
      message: `${organizationName} has been verified!`,
      url: `/organizations/${organizationId}`,
    },
  });
};

/**
 * Notify when an organization is updated
 */
export const notifyOrganizationUpdated = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string,
  updatedByName: string,
  updateDescription: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_UPDATED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      userName: updatedByName,
      description: updateDescription,
      title: "Organization Updated",
      message: `${updatedByName} updated ${organizationName}: ${updateDescription}`,
      url: `/organizations/${organizationId}`,
    },
  });
};

/**
 * Notify when an organization is deleted
 */
export const notifyOrganizationDeleted = async (
  app: Application,
  recipientId: string,
  organizationName: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_DELETED,
    recipientId,
    data: {
      organizationName,
      reason,
      title: "Organization Deleted",
      message: reason
        ? `${organizationName} has been deleted: ${reason}`
        : `${organizationName} has been deleted`,
    },
  });
};

/**
 * Notify when an organization is suspended
 */
export const notifyOrganizationSuspended = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string,
  reason: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_SUSPENDED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      reason,
      title: "Organization Suspended",
      message: `${organizationName} has been suspended: ${reason}`,
      url: `/organizations/${organizationId}`,
    },
  });
};

/**
 * Notify when added as an organization member
 */
export const notifyOrganizationMemberAdded = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string,
  role: string,
  addedByName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_MEMBER_ADDED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      roleName: role,
      userName: addedByName,
      title: "Added to Organization",
      message: `${addedByName} added you to ${organizationName} as ${role}`,
      url: `/organizations/${organizationId}`,
      actions: [
        {
          type: "view",
          label: "View Organization",
          url: `/organizations/${organizationId}`,
        },
      ],
    },
  });
};

/**
 * Notify when removed from an organization
 */
export const notifyOrganizationMemberRemoved = async (
  app: Application,
  recipientId: string,
  organizationName: string,
  removedByName: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
    recipientId,
    data: {
      organizationName,
      userName: removedByName,
      reason,
      title: "Removed from Organization",
      message: reason
        ? `${removedByName} removed you from ${organizationName}: ${reason}`
        : `${removedByName} removed you from ${organizationName}`,
    },
  });
};

/**
 * Notify when organization role changes
 */
export const notifyOrganizationRoleChanged = async (
  app: Application,
  recipientId: string,
  organizationId: string,
  organizationName: string,
  newRole: string,
  previousRole: string,
  changedByName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ORGANIZATION_ROLE_CHANGED,
    recipientId,
    data: {
      organizationId,
      organizationName,
      roleName: newRole,
      previousStatus: previousRole,
      userName: changedByName,
      title: "Role Changed",
      message: `${changedByName} changed your role in ${organizationName} from ${previousRole} to ${newRole}`,
      url: `/organizations/${organizationId}`,
    },
  });
};

// ===========================
// USER ACCOUNT NOTIFICATION HELPERS
// ===========================

/**
 * Notify when PIN is set
 */
export const notifyPinSet = async (
  app: Application,
  recipientId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PIN_SET,
    recipientId,
    data: {
      userName,
      title: "PIN Set Successfully",
      message: "Your security PIN has been set. You can now make secure transactions.",
      url: "/settings/security",
    },
  });
};

/**
 * Notify when PIN is changed
 */
export const notifyPinChanged = async (
  app: Application,
  recipientId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PIN_CHANGED,
    recipientId,
    data: {
      userName,
      title: "PIN Changed",
      message: "Your security PIN has been changed. If this wasn't you, please contact support immediately.",
      url: "/settings/security",
      actions: [
        {
          type: "support",
          label: "Contact Support",
          url: "/support",
        },
      ],
    },
  });
};

/**
 * Notify when password is changed
 */
export const notifyPasswordChanged = async (
  app: Application,
  recipientId: string,
  userName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PASSWORD_CHANGED,
    recipientId,
    data: {
      userName,
      title: "Password Changed",
      message: "Your password has been changed successfully. If this wasn't you, please contact support immediately.",
      url: "/settings/security",
      actions: [
        {
          type: "support",
          label: "Contact Support",
          url: "/support",
        },
      ],
    },
  });
};

/**
 * Notify when profile is updated
 */
export const notifyProfileUpdated = async (
  app: Application,
  recipientId: string,
  userName: string,
  updateFields: string[]
) => {
  return createAndSendNotification(app, {
    type: NotificationType.PROFILE_UPDATED,
    recipientId,
    data: {
      userName,
      title: "Profile Updated",
      message: `Your profile has been updated: ${updateFields.join(', ')}`,
      url: "/profile",
    },
  });
};

// ===========================
// ADMIN NOTIFICATION HELPERS
// ===========================

/**
 * Notify when admin creates a user account
 */
export const notifyAdminUserCreated = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  temporaryPassword?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_USER_CREATED,
    recipientId,
    data: {
      adminId,
      adminName,
      title: "Account Created",
      message: temporaryPassword
        ? `Your account has been created by ${adminName}. Use the temporary password sent to your email to log in.`
        : `Your account has been created by ${adminName}. Please check your email for login instructions.`,
      url: "/profile",
    },
  });
};

/**
 * Notify when admin updates a user account
 */
export const notifyAdminUserUpdated = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  updateDescription: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_USER_UPDATED,
    recipientId,
    data: {
      adminId,
      adminName,
      description: updateDescription,
      title: "Account Updated by Admin",
      message: `${adminName} updated your account: ${updateDescription}`,
      url: "/profile",
    },
  });
};

/**
 * Notify when admin deletes a user account
 */
export const notifyAdminUserDeleted = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  reason: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_USER_DELETED,
    recipientId,
    data: {
      adminId,
      adminName,
      reason,
      title: "Account Deleted",
      message: `Your account has been deleted by ${adminName}: ${reason}`,
    },
  });
};

/**
 * Notify when admin changes user status
 */
export const notifyAdminStatusChanged = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  previousStatus: string,
  newStatus: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_STATUS_CHANGED,
    recipientId,
    data: {
      adminId,
      adminName,
      previousStatus,
      newStatus,
      reason,
      title: "Account Status Changed",
      message: reason
        ? `${adminName} changed your status from ${previousStatus} to ${newStatus}: ${reason}`
        : `${adminName} changed your status from ${previousStatus} to ${newStatus}`,
      url: "/profile",
    },
  });
};

/**
 * Notify when admin assigns a role
 */
export const notifyAdminRoleAssigned = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  roleId: string,
  roleName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_ROLE_ASSIGNED,
    recipientId,
    data: {
      adminId,
      adminName,
      roleId,
      roleName,
      title: "New Role Assigned",
      message: `${adminName} assigned you the role: ${roleName}`,
      url: "/profile/roles",
    },
  });
};

/**
 * Notify when admin removes a role
 */
export const notifyAdminRoleRemoved = async (
  app: Application,
  recipientId: string,
  adminId: string,
  adminName: string,
  roleId: string,
  roleName: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.ADMIN_ROLE_REMOVED,
    recipientId,
    data: {
      adminId,
      adminName,
      roleId,
      roleName,
      reason,
      title: "Role Removed",
      message: reason
        ? `${adminName} removed your role "${roleName}": ${reason}`
        : `${adminName} removed your role "${roleName}"`,
      url: "/profile/roles",
    },
  });
};

// ===========================
// EXTERNAL ACCOUNT NOTIFICATION HELPERS
// ===========================

/**
 * Notify when an external account is linked
 */
export const notifyExternalAccountLinked = async (
  app: Application,
  recipientId: string,
  externalAccountId: string,
  externalAccountType: string,
  externalAccountName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.EXTERNAL_ACCOUNT_LINKED,
    recipientId,
    data: {
      externalAccountId,
      externalAccountType,
      externalAccountName,
      title: "External Account Linked",
      message: `Your ${externalAccountType} account (${externalAccountName}) has been linked successfully`,
      url: "/settings/external-accounts",
    },
  });
};

/**
 * Notify when an external account is unlinked
 */
export const notifyExternalAccountUnlinked = async (
  app: Application,
  recipientId: string,
  externalAccountType: string,
  externalAccountName: string,
  reason?: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.EXTERNAL_ACCOUNT_UNLINKED,
    recipientId,
    data: {
      externalAccountType,
      externalAccountName,
      reason,
      title: "External Account Unlinked",
      message: reason
        ? `Your ${externalAccountType} account (${externalAccountName}) has been unlinked: ${reason}`
        : `Your ${externalAccountType} account (${externalAccountName}) has been unlinked`,
      url: "/settings/external-accounts",
    },
  });
};

/**
 * Notify when an external account is verified
 */
export const notifyExternalAccountVerified = async (
  app: Application,
  recipientId: string,
  externalAccountId: string,
  externalAccountType: string,
  externalAccountName: string
) => {
  return createAndSendNotification(app, {
    type: NotificationType.EXTERNAL_ACCOUNT_VERIFIED,
    recipientId,
    data: {
      externalAccountId,
      externalAccountType,
      externalAccountName,
      title: "External Account Verified",
      message: `Your ${externalAccountType} account (${externalAccountName}) has been verified`,
      url: "/settings/external-accounts",
    },
  });
};
