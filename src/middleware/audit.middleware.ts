import { Request, Response, NextFunction } from "express";
import { insert_function } from "../utils/db_methods";
import { AuditLogCreationAttributes } from "../types/model";

// Sensitive fields to exclude from logging
const SENSITIVE_FIELDS = [
  "password",
  "transactionPin",
  "otp",
  "pinResetOtp",
  "fcmToken",
  "token",
  "refreshToken",
  "apiKey",
  "secret",
];

// Endpoints to skip logging (health checks, etc.)
const SKIP_ENDPOINTS = ["/health", "/api-docs", "/favicon.ico"];

// Filter sensitive data from objects (cycle-safe)
const filterSensitiveData = (
  obj: any,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (depth > 8) return "[MAX_DEPTH_REACHED]";

  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
    };
  }
  if (Buffer.isBuffer(obj)) return `[Buffer:${obj.length}]`;

  if (seen.has(obj)) {
    return "[CIRCULAR]";
  }
  seen.add(obj);

  if (typeof (obj as any).toJSON === "function") {
    try {
      const jsonObj = (obj as any).toJSON();
      if (jsonObj && jsonObj !== obj) {
        return filterSensitiveData(jsonObj, seen, depth + 1);
      }
    } catch (_error) {}
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => filterSensitiveData(item, seen, depth + 1));
  }

  const filtered: any = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      filtered[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "function") {
      filtered[key] = "[FUNCTION]";
      continue;
    }

    filtered[key] = filterSensitiveData(value, seen, depth + 1);
  }

  return filtered;
};

// Extract IP address from request
const getIpAddress = (req: Request): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || null;
};

// Determine action type from endpoint and method
const determineAction = (endpoint: string, method: string): string => {
  const path = endpoint.toLowerCase();

  // Authentication actions
  if (path.includes("/auth/login") || path.includes("/admin/auth/login"))
    return "LOGIN";
  if (path.includes("/auth/logout")) return "LOGOUT";
  if (path.includes("/auth/register")) return "REGISTER";
  if (path.includes("/auth/verify")) return "VERIFY_EMAIL";
  if (path.includes("/auth/reset")) return "RESET_PASSWORD";

  // User actions
  if (path.includes("/users")) {
    if (method === "POST") return "CREATE_USER";
    if (method === "PUT" || method === "PATCH") return "UPDATE_USER";
    if (method === "DELETE") return "DELETE_USER";
    return "VIEW_USER";
  }

  // Organization actions
  if (path.includes("/organizations")) {
    if (method === "POST") return "CREATE_ORGANIZATION";
    if (method === "PUT" || method === "PATCH") return "UPDATE_ORGANIZATION";
    if (method === "DELETE") return "DELETE_ORGANIZATION";
    if (path.includes("/approve")) return "APPROVE_ORGANIZATION";
    return "VIEW_ORGANIZATION";
  }

  // Transaction actions
  if (path.includes("/transactions")) {
    if (method === "POST") return "CREATE_TRANSACTION";
    if (path.includes("/refund")) return "REFUND_TRANSACTION";
    return "VIEW_TRANSACTION";
  }

  // Action management
  if (path.includes("/actions")) {
    if (method === "POST") return "CREATE_ACTION";
    if (method === "PUT" || method === "PATCH") {
      if (path.includes("/suspend")) return "SUSPEND_ACTION";
      if (path.includes("/unsuspend")) return "UNSUSPEND_ACTION";
      return "UPDATE_ACTION";
    }
    if (method === "DELETE") return "DELETE_ACTION";
    return "VIEW_ACTION";
  }

  // Role and permission actions
  if (path.includes("/roles")) {
    if (method === "POST") return "CREATE_ROLE";
    if (method === "PUT" || method === "PATCH") return "UPDATE_ROLE";
    if (method === "DELETE") return "DELETE_ROLE";
    return "VIEW_ROLE";
  }

  if (path.includes("/permissions")) {
    if (method === "POST") return "CREATE_PERMISSION";
    if (method === "PUT" || method === "PATCH") return "UPDATE_PERMISSION";
    if (method === "DELETE") return "DELETE_PERMISSION";
    return "VIEW_PERMISSION";
  }

  // Wallet actions
  if (path.includes("/wallets")) return "WALLET_OPERATION";

  // Generic fallback
  if (method === "POST") return "CREATE";
  if (method === "PUT" || method === "PATCH") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return "VIEW";
};

// Determine log level based on status code
const determineLevel = (
  statusCode: number,
): "info" | "warning" | "error" | "critical" => {
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "error";
  if (statusCode >= 300) return "warning";
  return "info";
};

/**
 * Audit logging middleware
 * Logs all API requests and responses to the audit trail
 */
export const auditLogger = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Skip certain endpoints
  if (SKIP_ENDPOINTS.some((skip) => req.path.includes(skip))) {
    return next();
  }

  const startTime = Date.now();

  // Store original res.json and res.send methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let responseBody: any = null;

  // Override res.json to capture response
  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  // Override res.send to capture response
  res.send = function (body: any) {
    if (!responseBody && body) {
      try {
        responseBody = typeof body === "string" ? JSON.parse(body) : body;
      } catch (e) {
        responseBody = { data: body };
      }
    }
    return originalSend(body);
  };

  // Log after response is sent
  res.on("finish", async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Extract user and organization from request (set by auth middleware)
      const userId = (req as any).user?.id || null;
      const organizationId = (req as any).user?.organizationId || null;

      const action = determineAction(req.path, req.method);
      const level = determineLevel(statusCode);

      // Filter sensitive data from request and response
      const filteredRequestBody = req.body
        ? filterSensitiveData(req.body)
        : null;
      const filteredResponseBody = responseBody
        ? filterSensitiveData(responseBody)
        : null;

      // Prepare audit log entry
      const auditData: AuditLogCreationAttributes = {
        userId,
        organizationId,
        action,
        method: req.method,
        endpoint: req.originalUrl || req.path,
        statusCode,
        ipAddress: getIpAddress(req),
        userAgent: req.headers["user-agent"] || null,
        requestBody: filteredRequestBody,
        responseBody: statusCode >= 400 ? filteredResponseBody : null, // Only log response body for errors
        metadata: {
          query: req.query,
          params: req.params,
        },
        duration,
        level,
      };

      // Insert audit log asynchronously (don't wait for it)
      insert_function<any>("AuditLog", "create", auditData).catch((error) => {
        console.error("Failed to create audit log:", error);
      });
    } catch (error) {
      console.error("Error in audit logging middleware:", error);
    }
  });

  next();
};

export default auditLogger;
