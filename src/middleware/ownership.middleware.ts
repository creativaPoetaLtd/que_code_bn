import { NextFunction, Response } from "express";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";
import { AuthRequest } from "./auth.unified.middleware";

const { Action, SubAction, QRObject, Profile } = database_models as any;

/**
 * Ownership checks for routes whose target is identified by a URL param. Each must run
 * after `authenticate`. Admins (super_admin / admin) pass every check.
 */

type OwnerResolver = (req: AuthRequest) => Promise<string | null | undefined>;

const requireOwner = (resolveOwnerId: OwnerResolver, notFoundMessage: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    try {
      const ownerId = await resolveOwnerId(req);
      if (ownerId === undefined) {
        res.status(404).json({ success: false, message: notFoundMessage });
        return;
      }
      if (req.user.isAdmin || (ownerId && ownerId === req.user.id)) {
        next();
        return;
      }
      res.status(403).json({ success: false, message: "You are not allowed to modify this resource" });
    } catch (error) {
      console.error("Ownership check error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
};

/** The caller is the organization in `:paramName` (or an admin). */
export const requireSelfOrganization = (paramName = "organizationId") =>
  requireOwner(async (req) => (req.params as Record<string, string>)[paramName] || null, "Organization not found");

/** The caller owns the action in `:actionId`. */
export const requireActionOwner = requireOwner(async (req) => {
  const action = await Action.findByPk(req.params.actionId, { attributes: ["id", "organizationId"] });
  return action ? action.organizationId : undefined;
}, "Action not found");

/** The caller owns the action that sub-action `:subActionId` belongs to. */
export const requireSubActionOwner = requireOwner(async (req) => {
  const subAction = await SubAction.findByPk(req.params.subActionId, {
    attributes: ["id", "actionId"],
    include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
  });
  return subAction ? subAction.action?.organizationId ?? null : undefined;
}, "Sub-action not found");

/**
 * The caller owns the action a QR object (ticket / pass) was issued for - i.e. the
 * organization scanning it at the door. `:qrObjectId` may also be the actionPurchaseId,
 * which is what the printed QR code contains.
 */
export const requireQRObjectOwner = requireOwner(async (req) => {
  const qrObject = await QRObject.findOne({
    where: { [Op.or]: [{ id: req.params.qrObjectId }, { actionPurchaseId: req.params.qrObjectId }] },
    attributes: ["id", "actionId"],
    include: [{ model: Action, as: "action", attributes: ["id", "organizationId"] }],
  });
  return qrObject ? qrObject.action?.organizationId ?? null : undefined;
}, "QR object not found");

/** The caller is the user or organization that profile `:id` belongs to. */
export const requireProfileOwner = requireOwner(async (req) => {
  const profile = await Profile.findByPk(req.params.id, { attributes: ["id", "userId", "organizationId"] });
  if (!profile) return undefined;
  return req.user?.accountType === "organization" ? profile.organizationId : profile.userId;
}, "Profile not found");
