// routes/admin.auth.routes.ts
import express from 'express';
import adminAuthController from '../controllers/admin.auth.controller';
import { requireAdmin } from '../middleware/admin.auth.middleware';

const router = express.Router();

/**
 * Admin Authentication Routes
 * Completely separate from user authentication
 */

// Admin login (NO middleware - public endpoint)
router.post('/login', adminAuthController.adminLogin);

// Verify admin token (requires admin middleware)
router.get('/verify', requireAdmin, adminAuthController.verifyAdminToken);

// Admin logout (requires admin middleware)
router.post('/logout', requireAdmin, adminAuthController.adminLogout);

export default router;
