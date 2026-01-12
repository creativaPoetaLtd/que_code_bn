import FirebaseService from './firebaseService';
import Models from '../database/models';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private firebaseService: FirebaseService;
  private models: ReturnType<typeof Models>;

  constructor(models: ReturnType<typeof Models>) {
    this.firebaseService = FirebaseService.getInstance();
    this.models = models;
  }

  async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const user = await this.models.User.findByPk(userId);
      if (!user) {
        console.warn(`[PushNotification] User not found: ${userId}`);
        return false;
      }

      if (!user.fcmToken) {
        console.log(`[PushNotification] No FCM token for user ${userId}`);
        return false;
      }

      console.log(`[PushNotification] Sending to user ${userId} (token: ${user.fcmToken.substring(0, 20)}...)`);
      return await this.firebaseService.sendNotification(user.fcmToken, payload);
    } catch (error) {
      console.error('[PushNotification] Error sending notification to user:', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async sendToMultipleUsers(userIds: string[], payload: NotificationPayload): Promise<{ successCount: number; failureCount: number }> {
    try {
      if (userIds.length === 0) {
        console.warn('[PushNotification] No user IDs provided');
        return { successCount: 0, failureCount: 0 };
      }

      const users = await this.models.User.findAll({
        where: { id: userIds },
        attributes: ['id', 'fcmToken'],
      });

      const tokens = users
        .map(user => user.fcmToken)
        .filter(token => token !== null) as string[];

      if (tokens.length === 0) {
        console.warn(`[PushNotification] No valid FCM tokens found for ${userIds.length} users`);
        return { successCount: 0, failureCount: userIds.length };
      }

      console.log(`[PushNotification] Sending to ${tokens.length} devices (${userIds.length} users requested)`);
      return await this.firebaseService.sendMulticast(tokens, payload);
    } catch (error) {
      console.error('[PushNotification] Error sending notifications to multiple users:', {
        userCount: userIds.length,
        error: error instanceof Error ? error.message : String(error)
      });
      return { successCount: 0, failureCount: userIds.length };
    }
  }

  async sendChatMessage(recipientId: string, senderName: string, message: string, chatId: string): Promise<boolean> {
    console.log(`[PushNotification] Chat message notification:`, {
      recipient: recipientId,
      sender: senderName,
      chatId,
      previewLength: message.length
    });

    return await this.sendToUser(recipientId, {
      title: senderName,
      body: message,
      data: {
        type: 'chat_message',
        chatId,
        senderId: recipientId,
      },
    });
  }

  async sendMoneyRequest(recipientId: string, senderName: string, amount: string): Promise<boolean> {
    console.log(`[PushNotification] Money request notification:`, {
      recipient: recipientId,
      sender: senderName,
      amount
    });

    return await this.sendToUser(recipientId, {
      title: 'Money Request',
      body: `${senderName} requested $${amount}`,
      data: {
        type: 'money_request',
        amount,
        senderId: recipientId,
      },
    });
  }

  async sendGroupInvite(recipientId: string, groupName: string, inviterName: string): Promise<boolean> {
    console.log(`[PushNotification] Group invite notification:`, {
      recipient: recipientId,
      group: groupName,
      inviter: inviterName
    });

    return await this.sendToUser(recipientId, {
      title: 'Group Invitation',
      body: `${inviterName} invited you to join ${groupName}`,
      data: {
        type: 'group_invite',
        groupName,
        inviterId: recipientId,
      },
    });
  }
}

export default PushNotificationService;