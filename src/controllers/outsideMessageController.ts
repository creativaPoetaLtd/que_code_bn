import { Request, Response } from "express";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";

const RATE_WINDOW_MS = 60 * 1000;
const MAX_PER_IP_PER_WINDOW = 20;
const MAX_PER_IP_RECEIVER_PER_WINDOW = 5;

const requestCounters = new Map<string, { count: number; windowStart: number }>();

const normalizeInput = (value: unknown): string => {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
};

const containsObviousSpam = (text: string): boolean => {
  const lower = text.toLowerCase();
  const blockedFragments = [
    "viagra",
    "casino",
    "crypto giveaway",
    "telegram.me/",
    "bit.ly/",
    "earn money fast",
  ];

  const links = (lower.match(/https?:\/\//g) || []).length;
  if (links > 3) {
    return true;
  }

  return blockedFragments.some((fragment) => lower.includes(fragment));
};

const checkRateLimit = (ip: string, receiverId: string): string | null => {
  const now = Date.now();
  const keys = [`ip:${ip}`, `ip:${ip}:receiver:${receiverId}`];

  for (const key of keys) {
    const existing = requestCounters.get(key);
    const withinWindow = existing && now - existing.windowStart < RATE_WINDOW_MS;

    if (!withinWindow) {
      requestCounters.set(key, { count: 1, windowStart: now });
      continue;
    }

    const limit = key.includes(":receiver:")
      ? MAX_PER_IP_RECEIVER_PER_WINDOW
      : MAX_PER_IP_PER_WINDOW;

    if (existing.count >= limit) {
      return "Rate limit exceeded. Please try again later.";
    }

    requestCounters.set(key, {
      count: existing.count + 1,
      windowStart: existing.windowStart,
    });
  }

  return null;
};

const isValidContact = (value: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9][0-9\s\-()]{6,}$/;
  return emailRegex.test(value) || phoneRegex.test(value);
};

export const createOutsideMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const receiverId = normalizeInput(req.body.receiverId);
    const senderName = normalizeInput(req.body.senderName);
    const senderContact = normalizeInput(req.body.senderContact);
    const message = normalizeInput(req.body.message);

    if (!receiverId || !senderName || !senderContact || !message) {
      res.status(400).json({
        success: false,
        message: "receiverId, senderName, senderContact and message are required",
      });
      return;
    }

    if (senderName.length > 120 || senderContact.length > 160 || message.length > 5000) {
      res.status(400).json({
        success: false,
        message: "Input exceeds allowed length",
      });
      return;
    }

    if (!isValidContact(senderContact)) {
      res.status(400).json({
        success: false,
        message: "senderContact must be a valid email or phone number",
      });
      return;
    }

    if (containsObviousSpam(`${senderName} ${senderContact} ${message}`)) {
      res.status(400).json({
        success: false,
        message: "Message was blocked by anti-spam protection",
      });
      return;
    }

    const captchaRequired = process.env.OUTSIDE_MESSAGE_CAPTCHA_REQUIRED === "true";
    if (captchaRequired && !req.header("x-captcha-token")) {
      res.status(400).json({
        success: false,
        message: "Captcha token is required",
      });
      return;
    }

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";

    const rateLimitError = checkRateLimit(ip, receiverId);
    if (rateLimitError) {
      res.status(429).json({ success: false, message: rateLimitError });
      return;
    }

    const [receiverUser, receiverOrg] = await Promise.all([
      database_models.User.findByPk(receiverId, { attributes: ["id"] }),
      database_models.Organization.findByPk(receiverId, { attributes: ["id"] }),
    ]);

    if (!receiverUser && !receiverOrg) {
      res.status(404).json({ success: false, message: "Receiver not found" });
      return;
    }

    const created = await database_models.OutsideMessage.create({
      receiverId,
      senderName,
      senderContact,
      message,
      status: "unread",
      source: "welcome_page",
      meta: {
        ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    const plain = created.get({ plain: true });

    res.status(201).json({
      success: true,
      data: {
        id: plain.id,
        receiverId: plain.receiverId,
        senderName: plain.senderName,
        senderContact: plain.senderContact,
        message: plain.message,
        status: plain.status,
        createdAt: plain.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to create outside message",
      error: error.message,
    });
  }
};

export const getOutsideMessagesInbox = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const receiverId = authUser.id;
    const statusParam = String(req.query.status || "all").toLowerCase();
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const offset = (page - 1) * limit;

    const where: any = { receiverId };
    if (statusParam === "unread" || statusParam === "read") {
      where.status = statusParam;
    }

    const [items, total, unreadCount] = await Promise.all([
      database_models.OutsideMessage.findAll({
        where,
        attributes: [
          "id",
          "senderName",
          "senderContact",
          "message",
          "status",
          "createdAt",
          "readAt",
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      database_models.OutsideMessage.count({ where }),
      database_models.OutsideMessage.count({
        where: {
          receiverId,
          status: "unread",
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: items.map((row: any) => row.get({ plain: true })),
        total,
        page,
        limit,
        unreadCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch outside messages inbox",
      error: error.message,
    });
  }
};

export const markOutsideMessageRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const receiverId = authUser.id;
    const { id } = req.params;

    const message = await database_models.OutsideMessage.findByPk(id);
    if (!message) {
      res.status(404).json({ success: false, message: "Outside message not found" });
      return;
    }

    if (message.receiverId !== receiverId) {
      res.status(403).json({ success: false, message: "Not allowed to modify this message" });
      return;
    }

    if (message.status !== "read") {
      message.status = "read";
      message.readAt = new Date();
      await message.save();
    }

    res.status(200).json({
      success: true,
      data: {
        id: message.id,
        status: message.status,
        readAt: message.readAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to mark outside message as read",
      error: error.message,
    });
  }
};
