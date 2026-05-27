import { Application } from "express";
import Models from "../database/models";
import { NotificationPayload, NotificationType } from "../utils/notificationConfig";

const webpush = require("web-push");

type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  preferences?: {
    soundEnabled?: boolean;
    vibrationEnabled?: boolean;
  };
};

type PushMessage = {
  title: string;
  body: string;
  icon: string;
  badge: string;
  url: string;
  tag: string;
  renotify: boolean;
  requireInteraction: boolean;
  silent: boolean;
  vibrate: number[];
  data: Record<string, unknown>;
};

class WebPushService {
  private configured = false;
  private warnedMissingConfig = false;
  private readonly pushTtlSeconds = Number(
    process.env.WEB_PUSH_TTL_SECONDS || 7 * 24 * 60 * 60,
  );

  private configure() {
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const subject =
      process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:notifications@qiewcode.app";

    if (!publicKey || !privateKey) {
      this.configured = false;
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  public isConfigured() {
    if (!this.configured) {
      this.configure();
    }

    return this.configured;
  }

  private warnIfMissingConfig() {
    if (this.warnedMissingConfig) {
      return;
    }

    this.warnedMissingConfig = true;
    console.warn(
      "[WebPush] Missing VAPID configuration. Set WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT.",
    );
  }

  private humanizeType(type: NotificationType) {
    return type
      .split("_")
      .map((chunk) => chunk.charAt(0) + chunk.slice(1).toLowerCase())
      .join(" ");
  }

  private buildTitle(payload: NotificationPayload) {
    if (payload.data.messageType === "secure") {
      return "New secure message";
    }

    return payload.data.title || this.humanizeType(payload.type);
  }

  private buildBody(payload: NotificationPayload) {
    if (payload.data.messageType === "secure") {
      return "Open QueCode to view this encrypted message.";
    }

    return (
      payload.data.message ||
      payload.data.description ||
      "You have a new notification in QueCode."
    );
  }

  private buildUrl(payload: NotificationPayload) {
    if (payload.data.url) {
      return payload.data.url;
    }

    if (payload.data.chatId) {
      return `/chat?chatId=${payload.data.chatId}`;
    }

    if (payload.data.groupId) {
      return `/groups/${payload.data.groupId}`;
    }

    if (payload.data.contactId) {
      return `/contacts`;
    }

    if (payload.data.transactionId) {
      return `/transactions`;
    }

    return "/notifications";
  }

  private buildTag(payload: NotificationPayload, notificationId?: string) {
    if (notificationId) {
      return `notification-${notificationId}`;
    }

    if (payload.data.chatId) {
      return `chat-${payload.data.chatId}`;
    }

    return `notification-${payload.type.toLowerCase()}`;
  }

  private buildMessage(
    payload: NotificationPayload,
    notificationId?: string,
    preferences?: StoredPushSubscription["preferences"],
  ): PushMessage {
    const soundEnabled = preferences?.soundEnabled !== false;
    const vibrationEnabled = preferences?.vibrationEnabled !== false;

    return {
      title: this.buildTitle(payload),
      body: this.buildBody(payload),
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      url: this.buildUrl(payload),
      tag: this.buildTag(payload, notificationId),
      renotify: true,
      requireInteraction: false,
      silent: !soundEnabled && !vibrationEnabled,
      vibrate: vibrationEnabled ? [200, 100, 200] : [],
      data: {
        notificationId,
        type: payload.type,
        ...(payload.data.messageType === "secure"
          ? {
              chatId: payload.data.chatId,
              messageId: payload.data.messageId,
              messageType: "secure",
              url: payload.data.url,
            }
          : payload.data),
      },
    };
  }

  public async sendToUser(
    app: Application,
    userId: string,
    payload: NotificationPayload,
    notificationId?: string,
  ) {
    const models = app.get("models") as ReturnType<typeof Models>;
    const subscriptions = await models.PushSubscription.findAll({
      where: { userId, isActive: true },
    });

    if (!subscriptions.length) {
      return { sent: 0, failed: 0 };
    }

    if (!this.isConfigured()) {
      this.warnIfMissingConfig();
      return { sent: 0, failed: subscriptions.length };
    }

    let sent = 0;
    let failed = 0;

    for (const record of subscriptions) {
      const subscription = record.subscription as StoredPushSubscription;

      if (!subscription?.endpoint || !subscription?.keys?.auth || !subscription?.keys?.p256dh) {
        failed += 1;
        await record.update({
          isActive: false,
          lastFailureAt: new Date(),
          lastFailureReason: "Invalid stored push subscription",
        });
        continue;
      }

      try {
        const pushTarget = {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: subscription.keys,
        };
        const message = JSON.stringify(
          this.buildMessage(payload, notificationId, subscription.preferences),
        );

        await webpush.sendNotification(pushTarget, message, {
          TTL: this.pushTtlSeconds,
          urgency: "high",
        });

        sent += 1;
        await record.update({
          isActive: true,
          lastSeenAt: new Date(),
          lastSuccessfulAt: new Date(),
          lastFailureAt: null,
          lastFailureReason: null,
        });
      } catch (error: any) {
        failed += 1;

        const statusCode = error?.statusCode;
        const failureReason =
          error?.body || error?.message || "Unknown web push delivery error";

        if (statusCode === 404 || statusCode === 410) {
          await record.destroy();
          continue;
        }

        if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
          await record.update({
            isActive: false,
            lastFailureAt: new Date(),
            lastFailureReason: failureReason,
          });
          continue;
        }

        await record.update({
          isActive: true,
          lastSeenAt: new Date(),
          lastFailureAt: new Date(),
          lastFailureReason: failureReason,
        });
      }
    }

    return { sent, failed };
  }
}

export const webPushService = new WebPushService();
