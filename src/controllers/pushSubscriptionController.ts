import { NextFunction, Response } from "express";
import Models from "../database/models";
import { AuthenticatedRequest } from "../types/requests";

type PushSubscriptionBody = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

const normalizeSubscription = (input: any): PushSubscriptionBody | null => {
  const subscription = input?.subscription || input;

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime:
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
};

export const upsertPushSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const subscription = normalizeSubscription(req.body);
    const userAgent =
      typeof req.body?.userAgent === "string" ? req.body.userAgent : req.header("user-agent");

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: "A valid web push subscription is required",
      });
    }

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Push subscriptions are supported for user accounts only",
      });
    }

    const [record] = await models.PushSubscription.findOrCreate({
      where: { endpoint: subscription.endpoint },
      defaults: {
        userId,
        endpoint: subscription.endpoint,
        subscription,
        userAgent: userAgent || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    await record.update({
      userId,
      endpoint: subscription.endpoint,
      subscription,
      userAgent: userAgent || null,
      isActive: true,
      lastSeenAt: new Date(),
      lastFailureAt: null,
      lastFailureReason: null,
    });

    return res.status(200).json({
      success: true,
      message: "Push subscription saved",
      data: {
        id: record.id,
        endpoint: record.endpoint,
      },
    });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    next(error);
  }
};

export const deletePushSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const models = req.app.get("models") as ReturnType<typeof Models>;
    const endpoint =
      typeof req.body?.endpoint === "string" ? req.body.endpoint : undefined;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Subscription endpoint is required",
      });
    }

    const deletedCount = await models.PushSubscription.destroy({
      where: { userId, endpoint },
    });

    return res.status(200).json({
      success: true,
      message:
        deletedCount > 0
          ? "Push subscription removed"
          : "No matching push subscription found",
    });
  } catch (error) {
    console.error("Error deleting push subscription:", error);
    next(error);
  }
};
