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
