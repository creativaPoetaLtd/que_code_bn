import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import * as bcrypt from 'bcrypt';
import database_models from '../database/config/db.config';
import sendEmail from '../helpers/email';
import { notifyPinSet, notifyPinChanged } from '../utils/notificationHelpers';

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

    // Send PIN set notification
    try {
      await notifyPinSet(
        req.app,
        userId,
        `${user.firstName} ${user.lastName}`
      );
    } catch (notificationError) {
      console.error('Failed to send PIN set notification:', notificationError);
    }

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
      const maxAttempts = 3;
      const lockoutMinutes = 15;

      let updateData: any = { pinAttempts: newAttempts };

      // Check if max attempts reached
      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        updateData.pinLockedUntil = lockedUntil;

        await user.update(updateData);

        // Send account blocked email notification
        try {
          await sendEmail({
            to: user.email,
            subject: 'Account Locked - PIN Reset Required',
            type: 'account_blocked',
            data: {
              name: user.firstName,
              lockoutMinutes: lockoutMinutes.toString(),
              resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/security?tab=pin-reset`
            }
          });
        } catch (emailError) {
          console.error('Failed to send account blocked email:', emailError);
        }

        res.status(429).json({
          success: false,
          message: `Account locked due to too many failed PIN attempts. Please reset your PIN to regain access.`,
          attemptsRemaining: 0,
          lockedUntil: lockedUntil,
          remainingMinutes: lockoutMinutes
        });
      } else {
        await user.update(updateData);

        const attemptsRemaining = maxAttempts - newAttempts;
        res.status(400).json({
          success: false,
          message: `Invalid PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining. Account will be locked after ${maxAttempts} failed attempts.`,
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
  try {
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPin || !newPin) {
      res.status(400).json({
        success: false,
        message: 'Current PIN and new PIN are required'
      });
      return;
    }

    // Validate new PIN format
    if (!validatePin(newPin)) {
      res.status(400).json({
        success: false,
        message: 'New PIN must be exactly 4 digits'
      });
      return;
    }

    // Validate current PIN format
    if (!validatePin(currentPin)) {
      res.status(400).json({
        success: false,
        message: 'Current PIN must be exactly 4 digits'
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
        message: 'No PIN is currently set for this user'
      });
      return;
    }

    // Check if user is currently locked out
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000);
      res.status(429).json({
        success: false,
        message: `Account is temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: user.pinLockedUntil,
        remainingMinutes: remainingTime
      });
      return;
    }

    // Verify current PIN
    const isCurrentPinValid = await bcrypt.compare(currentPin, user.transactionPin);
    if (!isCurrentPinValid) {
      // Increment failed attempts for wrong current PIN
      const newAttempts = (user.pinAttempts || 0) + 1;
      const maxAttempts = 3;
      const lockoutMinutes = 15;

      let updateData: any = { pinAttempts: newAttempts };

      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        updateData.pinLockedUntil = lockedUntil;

        await user.update(updateData);

        // Send account blocked email notification
        try {
          await sendEmail({
            to: user.email,
            subject: 'Account Locked - PIN Reset Required',
            type: 'account_blocked',
            data: {
              name: user.firstName,
              lockoutMinutes: lockoutMinutes.toString(),
              resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/security?tab=pin-reset`
            }
          });
        } catch (emailError) {
          console.error('Failed to send account blocked email:', emailError);
        }

        res.status(429).json({
          success: false,
          message: `Account locked due to too many failed PIN attempts. Please reset your PIN to regain access.`,
          attemptsRemaining: 0,
          lockedUntil: lockedUntil,
          remainingMinutes: lockoutMinutes
        });
      } else {
        await user.update(updateData);

        const attemptsRemaining = maxAttempts - newAttempts;
        res.status(400).json({
          success: false,
          message: `Invalid current PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining. Account will be locked after ${maxAttempts} failed attempts.`,
          attemptsRemaining: attemptsRemaining
        });
      }
      return;
    }

    // Check if new PIN is different from current PIN
    const isSamePin = await bcrypt.compare(newPin, user.transactionPin);
    if (isSamePin) {
      res.status(400).json({
        success: false,
        message: 'New PIN must be different from current PIN'
      });
      return;
    }

    // Hash the new PIN
    const saltRounds = 10;
    const hashedNewPin = await bcrypt.hash(newPin, saltRounds);

    // Update user with new PIN and reset attempts
    await user.update({
      transactionPin: hashedNewPin,
      pinAttempts: 0,
      pinLockedUntil: null
    });

    // Send PIN changed notification
    try {
      await notifyPinChanged(
        req.app,
        userId,
        `${user.firstName} ${user.lastName}`
      );
    } catch (notificationError) {
      console.error('Failed to send PIN changed notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: 'PIN changed successfully'
    });

  } catch (error) {
    console.error('PIN change error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PIN change'
    });
  }
};

// Reset PIN attempts (admin function or after successful verification)
const resetPinAttempts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Check if PIN is set
    if (!user.hasPinSet) {
      res.status(400).json({
        success: false,
        message: 'No PIN is set for this user'
      });
      return;
    }

    // Reset PIN attempts and clear lockout
    await user.update({
      pinAttempts: 0,
      pinLockedUntil: null
    });

    res.status(200).json({
      success: true,
      message: 'PIN attempts reset successfully',
      data: {
        pinAttempts: 0,
        pinLockedUntil: null,
        canAttemptPin: true
      }
    });

  } catch (error) {
    console.error('PIN attempts reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PIN attempts reset'
    });
  }
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
        maxAttempts: 3,
        attemptsRemaining: Math.max(0, 3 - (user.pinAttempts || 0)),
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

// Request PIN reset - generates and sends OTP
const requestPinReset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { verificationMethod } = req.body;

    // Validate verification method
    if (verificationMethod !== 'email' && verificationMethod !== 'sms') {
      res.status(400).json({
        success: false,
        message: 'Invalid verification method. Must be "email" or "sms"'
      });
      return;
    }

    // Only email is supported for now
    if (verificationMethod === 'sms') {
      res.status(400).json({
        success: false,
        message: 'SMS verification is not yet supported. Please use email.'
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

    // Check if user has a PIN set
    if (!user.hasPinSet) {
      res.status(400).json({
        success: false,
        message: 'No PIN is set for this user. Please set up a PIN first.'
      });
      return;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60000); // 15 minutes from now

    // Store OTP in database
    await user.update({
      pinResetOtp: otp,
      pinResetOtpExpires: otpExpires
    });

    // Send email with OTP
    try {
      await sendEmail({
        to: user.email,
        subject: 'PIN Reset Code - QuéCode',
        type: 'code',
        data: {
          code: otp,
          name: user.firstName,
          expiryTime: '15 minutes'
        }
      });

      res.status(200).json({
        success: true,
        message: `PIN reset code has been sent to your ${verificationMethod}`,
        data: {
          expiresIn: 15 // minutes
        }
      });

    } catch (emailError) {
      console.error('Failed to send PIN reset email:', emailError);
      
      // Clear the OTP if email fails
      await user.update({
        pinResetOtp: null,
        pinResetOtpExpires: null
      });

      res.status(500).json({
        success: false,
        message: 'Failed to send reset code. Please try again later.'
      });
    }

  } catch (error) {
    console.error('Request PIN reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while requesting PIN reset'
    });
  }
};

// Confirm PIN reset - verifies OTP and sets new PIN
const confirmPinReset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { resetToken, newPin } = req.body;

    // Validate inputs
    if (!resetToken || !newPin) {
      res.status(400).json({
        success: false,
        message: 'Reset code and new PIN are required'
      });
      return;
    }

    // Validate new PIN format
    if (!validatePin(newPin)) {
      res.status(400).json({
        success: false,
        message: 'New PIN must be exactly 4 digits'
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

    // Check if user has a PIN set
    if (!user.hasPinSet) {
      res.status(400).json({
        success: false,
        message: 'No PIN is set for this user'
      });
      return;
    }

    // Check if OTP exists
    if (!user.pinResetOtp || !user.pinResetOtpExpires) {
      res.status(400).json({
        success: false,
        message: 'No reset code found. Please request a new reset code.'
      });
      return;
    }

    // Check if OTP has expired
    if (user.pinResetOtpExpires < new Date()) {
      // Clear expired OTP
      await user.update({
        pinResetOtp: null,
        pinResetOtpExpires: null
      });

      res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.'
      });
      return;
    }

    // Verify OTP
    if (user.pinResetOtp !== resetToken) {
      res.status(400).json({
        success: false,
        message: 'Invalid reset code. Please check and try again.'
      });
      return;
    }

    // Hash the new PIN
    const saltRounds = 10;
    const hashedNewPin = await bcrypt.hash(newPin, saltRounds);

    // Update user with new PIN and clear reset data
    await user.update({
      transactionPin: hashedNewPin,
      pinResetOtp: null,
      pinResetOtpExpires: null,
      pinAttempts: 0, // Reset failed attempts
      pinLockedUntil: null // Clear any lockout
    });

    res.status(200).json({
      success: true,
      message: 'PIN has been reset successfully'
    });

  } catch (error) {
    console.error('Confirm PIN reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while confirming PIN reset'
    });
  }
};

// Validate PIN reset token (OTP) without resetting PIN
const validateResetToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { resetToken } = req.body;

    // Validate input
    if (!resetToken) {
      res.status(400).json({
        success: false,
        message: 'Reset code is required'
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

    // Check if user has a PIN set
    if (!user.hasPinSet) {
      res.status(400).json({
        success: false,
        message: 'No PIN is set for this user'
      });
      return;
    }

    // Check if OTP exists
    if (!user.pinResetOtp || !user.pinResetOtpExpires) {
      res.status(400).json({
        success: false,
        message: 'No reset code found. Please request a new reset code.'
      });
      return;
    }

    // Check if OTP has expired
    if (user.pinResetOtpExpires < new Date()) {
      // Clear expired OTP
      await user.update({
        pinResetOtp: null,
        pinResetOtpExpires: null
      });

      res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.'
      });
      return;
    }

    // Verify OTP
    if (user.pinResetOtp !== resetToken) {
      res.status(400).json({
        success: false,
        message: 'Invalid reset code. Please check and try again.'
      });
      return;
    }

    // Token is valid
    res.status(200).json({
      success: true,
      message: 'Reset code is valid',
      data: {
        valid: true
      }
    });

  } catch (error) {
    console.error('Validate PIN reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while validating reset code'
    });
  }
};

export default {
  setupPIN,
  verifyPIN,
  changePIN,
  resetPinAttempts,
  getPinStatus,
  requestPinReset,
  confirmPinReset,
  validateResetToken
};