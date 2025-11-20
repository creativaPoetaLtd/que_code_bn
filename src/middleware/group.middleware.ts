import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

// Validation middleware for group creation
export const validateGroupCreation = [
    body('name')
        .notEmpty()
        .withMessage('Group name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Group name must be between 2 and 100 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
        .trim(),

    body('picture')
        .optional()
        .isURL()
        .withMessage('Picture must be a valid URL'),

    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),

    body('maxMembers')
        .optional()
        .isInt({ min: 2, max: 1000 })
        .withMessage('maxMembers must be between 2 and 1000'),

    body('memberIds')
        .optional()
        .isArray()
        .withMessage('memberIds must be an array')
        .custom((value) => {
            if (value && value.length > 50) {
                throw new Error('Cannot invite more than 50 members at once');
            }
            return true;
        }),

    body('memberIds.*')
        .optional()
        .isString()
        .withMessage('Each member ID must be a string')
        .isLength({ min: 1 })
        .withMessage('Member ID cannot be empty'),

    body('adminId')
        .optional()
        .isUUID()
        .withMessage('adminId must be a valid UUID'),

    body('privacyType')
        .optional()
        .isIn(['private', 'public', 'require_approval'])
        .withMessage('Privacy type must be private, public, or require_approval'),

    body('hasFundraising')
        .optional()
        .isBoolean()
        .withMessage('hasFundraising must be a boolean'),

    body('fundraisingTarget')
        .optional()
        .custom((value, { req }) => {
            if (req.body.hasFundraising && !value) {
                throw new Error('Fundraising target is required when fundraising is enabled');
            }
            if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                throw new Error('Fundraising target must be a positive number');
            }
            return true;
        }),

    body('expirationDate')
        .optional()
        .isISO8601()
        .withMessage('Expiration date must be a valid date'),

    body('expirationType')
        .optional()
        .isIn(['custom_date', 'target_reached', 'deadline_reached', 'never'])
        .withMessage('Expiration type must be custom_date, target_reached, deadline_reached, or never'),

    body('hasAdditionalInfo')
        .optional()
        .isBoolean()
        .withMessage('hasAdditionalInfo must be a boolean'),

    body('additionalInfoPrompt')
        .optional()
        .custom((value, { req }) => {
            if (req.body.hasAdditionalInfo && !value) {
                throw new Error('Additional info prompt is required when additional info is enabled');
            }
            if (value && value.length > 500) {
                throw new Error('Additional info prompt cannot exceed 500 characters');
            }
            return true;
        }),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

// Validation middleware for group invitation
export const validateGroupInvitation = [
    body('groupId')
        .notEmpty()
        .withMessage('Group ID is required')
        .isUUID()
        .withMessage('Group ID must be a valid UUID'),

    body('memberIds')
        .notEmpty()
        .withMessage('Member IDs are required')
        .isArray({ min: 1 })
        .withMessage('memberIds must be a non-empty array')
        .custom((value) => {
            if (value.length > 20) {
                throw new Error('Cannot invite more than 20 members at once');
            }
            return true;
        }),

    body('memberIds.*')
        .isString()
        .withMessage('Each member ID must be a string')
        .isLength({ min: 1 })
        .withMessage('Member ID cannot be empty'),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

// Validation middleware for group invitation response
export const validateGroupResponse = [
    body('action')
        .notEmpty()
        .withMessage('Action is required')
        .isIn(['accept', 'reject'])
        .withMessage('Action must be either "accept" or "reject"'),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

// Validation middleware for joining group by link
export const validateJoinByLink = [
    body('accessToken')
        .notEmpty()
        .withMessage('Access token is required')
        .isUUID()
        .withMessage('Access token must be a valid UUID'),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

// Validation middleware for group update
export const validateGroupUpdate = [
    body('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Group name must be between 2 and 100 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
        .trim(),

    body('picture')
        .optional()
        .isURL()
        .withMessage('Picture must be a valid URL'),

    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),

    body('maxMembers')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('maxMembers must be between 1 and 1000'),

    (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];