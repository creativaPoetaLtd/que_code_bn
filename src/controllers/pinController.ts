import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import * as bcrypt from 'bcrypt';
import database_models from '../database/config/db.config';

const { User } = database_models;

// Helper function to validate 4-digit PIN
const validatePin = (pin: string): boolean => {
  return /^\d{4}$/.test(pin);
};

// Setup PIN for first-time users
const setupPIN = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { pin } = req.body;
    const userId = req.user.id;

    // Validate PIN format
    if (!pin || !validatePin(pin)) {
      res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
      return;
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if PIN is already set
    if (user.hasPinSet) {
      res.status(400).json({
        success: false,
        message: 'PIN is already set for this user'
      });
      return;
    }

    // Hash the PIN
    const saltRounds = 10;
    const hashedPin = await bcrypt.hash(pin, saltRounds);

    // Update user with hashed PIN
    await user.update({
      transactionPin: hashedPin,
      hasPinSet: true,
      pinAttempts: 0, // Reset attempts on successful setup
      pinLockedUntil: null // Clear any existing lockout
    });

    res.status(200).json({
      success: true,
      message: 'PIN set up successfully'
    });

  } catch (error) {
    console.error('PIN setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PIN setup'
    });
  }
};

// Verify PIN for transactions
const verifyPIN = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { pin } = req.body;
    const userId = req.user.id;

    // Validate PIN format
    if (!pin || !validatePin(pin)) {
      res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
      return;
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if PIN is set
    if (!user.hasPinSet || !user.transactionPin) {
      res.status(400).json({
        success: false,
        message: 'PIN not set up for this user'
      });
      return;
    }

    // Check if user is currently locked out
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000); // minutes
      res.status(429).json({
        success: false,
        message: `PIN is temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: user.pinLockedUntil,
        remainingMinutes: remainingTime
      });
      return;
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.transactionPin);

    if (isValidPin) {
      // Successful verification - reset attempts and clear lockout
      await user.update({
        pinAttempts: 0,
        pinLockedUntil: null
      });

      res.status(200).json({
        success: true,
        message: 'PIN verified successfully'
      });
    } else {
      // Failed verification - increment attempts
      const newAttempts = (user.pinAttempts || 0) + 1;
      const maxAttempts = 5;
      const lockoutMinutes = 15;

      let updateData: any = { pinAttempts: newAttempts };

      // Check if max attempts reached
      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        updateData.pinLockedUntil = lockedUntil;

        await user.update(updateData);

        res.status(429).json({
          success: false,
          message: `PIN verification failed. Account locked for ${lockoutMinutes} minutes due to too many failed attempts.`,
          attemptsRemaining: 0,
          lockedUntil: lockedUntil,
          remainingMinutes: lockoutMinutes
        });
      } else {
        await user.update(updateData);

        const attemptsRemaining = maxAttempts - newAttempts;
        res.status(400).json({
          success: false,
          message: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
          attemptsRemaining: attemptsRemaining
        });
      }
    }

  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PIN verification'
    });
  }
};

// Change existing PIN
const changePIN = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // TODO: Implement PIN change logic
  res.status(501).json({
    success: false,
    message: 'PIN change not implemented yet'
  });
};

// Reset PIN attempts (admin function or after successful verification)
const resetPinAttempts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // TODO: Implement PIN attempts reset logic
  res.status(501).json({
    success: false,
    message: 'PIN attempts reset not implemented yet'
  });
};

// Get PIN status for current user
const getPinStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Calculate remaining lockout time if locked
    let remainingMinutes = 0;
    let isLocked = false;
    
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      isLocked = true;
      remainingMinutes = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000);
    }

    res.status(200).json({
      success: true,
      data: {
        hasPinSet: user.hasPinSet,
        pinAttempts: user.pinAttempts || 0,
        maxAttempts: 5,
        attemptsRemaining: Math.max(0, 5 - (user.pinAttempts || 0)),
        isLocked: isLocked,
        lockedUntil: user.pinLockedUntil,
        remainingMinutes: remainingMinutes,
        canAttemptPin: !isLocked && user.hasPinSet
      }
    });

  } catch (error) {
    console.error('Get PIN status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while getting PIN status'
    });
  }
};

export default {
  setupPIN,
  verifyPIN,
  changePIN,
  resetPinAttempts,
  getPinStatus
};