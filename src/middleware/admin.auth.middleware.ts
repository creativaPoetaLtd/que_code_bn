// middleware/admin.auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Separate JWT secret for admin tokens (CRITICAL for security)
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_super_secret_key_CHANGE_THIS';

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
  type: 'admin';
  permissions: string[];
}

// Extend Express Request to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

/**
 * Middleware to verify admin authentication
 * Uses separate JWT secret from user tokens
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No admin token provided'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with ADMIN secret (not user secret)
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as AdminTokenPayload;

    // CRITICAL SECURITY CHECKS:
    
    // 1. Must be admin type token
    if (decoded.type !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Invalid token type - admin access required'
      });
      return;
    }

    // 2. Must have admin role
    if (!['admin', 'super_admin'].includes(decoded.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient privileges - admin role required'
      });
      return;
    }

    // Attach admin data to request
    req.admin = decoded;
    
    // Log admin action for audit trail
    console.log(`[ADMIN ACTION] ${decoded.email} - ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid admin token'
      });
      return;
    }
    
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Admin token expired - please login again'
      });
      return;
    }

    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware to check specific permission
 * Use after requireAdmin middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated as admin'
      });
      return;
    }

    if (!req.admin.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Permission denied - requires ${permission}`
      });
      return;
    }

    next();
  };
};
