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
      if (!user?.fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return false;
      }

      return await this.firebaseService.sendNotification(user.fcmToken, payload);
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return false;
    }
  }

  async sendToMultipleUsers(userIds: string[], payload: NotificationPayload): Promise<{ successCount: number; failureCount: number }> {
    try {
      const users = await this.models.User.findAll({
        where: { id: userIds },
        attributes: ['fcmToken'],
      });

      const tokens = users
        .map(user => user.fcmToken)
        .filter(token => token !== null) as string[];

      if (tokens.length === 0) {
        return { successCount: 0, failureCount: userIds.length };
      }

      return await this.firebaseService.sendMulticast(tokens, payload);
    } catch (error) {
      console.error('Error sending notifications to multiple users:', error);
      return { successCount: 0, failureCount: userIds.length };
    }
  }

  async sendChatMessage(recipientId: string, senderName: string, message: string, chatId: string): Promise<boolean> {
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
    return await this.sendToUser(recipientId, {
      title: 'Money Request',
      body: `${senderName} requested $${amount}`,
      data: {
        type: 'money_request',
        amount,
      },
    });
  }

  async sendGroupInvite(recipientId: string, groupName: string, inviterName: string): Promise<boolean> {
    return await this.sendToUser(recipientId, {
      title: 'Group Invitation',
      body: `${inviterName} invited you to join ${groupName}`,
      data: {
        type: 'group_invite',
        groupName,
      },
    });
  }
}

export default PushNotificationService;