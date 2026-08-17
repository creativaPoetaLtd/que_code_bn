import { Response } from "express";
import database_models from "../database/config/db.config";
import { AuthenticatedRequest } from "../types/requests";

const { Escrow, User } = database_models as any;

// Same shape as PARTY_INCLUDES in escrowController.ts. disputeRaisedBy/disputeRespondedBy/
// resolvedByAdminId are plain UUID columns with no association defined - the admin UI
// can resolve those against payerUser/payeeUser (a dispute party) or fetch the admin
// separately if needed, rather than adding new associations for this.
const PARTY_INCLUDES = [
  { model: User, as: "payerUser", attributes: ["id", "firstName", "lastName", "email"] },
  { model: User, as: "payeeUser", attributes: ["id", "firstName", "lastName", "email"] },
];

/**
 * Lists escrows for admin review - defaults to disputed ones (the review queue),
 * but accepts any status so already-resolved disputes can be looked back on too.
 * GET /api/v1/admin/escrow-disputes
 */
const getAllDisputes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status = "disputed", page = 1, limit = 20 } = req.query as {
      status?: string;
      page?: string | number;
      limit?: string | number;
    };

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 20);

    const where: any = status && status !== "all" ? { status } : {};

    const result = await Escrow.findAndCountAll({
      where,
      include: PARTY_INCLUDES,
      order: [["disputeRaisedAt", "DESC"]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    });

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(result.count / pageSize),
      },
    });
  } catch (error) {
    console.error("Get all escrow disputes error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Full detail of a single escrow for admin review - no ownership check, since an
 * admin isn't a party to the escrow they're reviewing.
 * GET /api/v1/admin/escrow-disputes/:id
 */
const getDisputeById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const escrow = await Escrow.findByPk(id, { include: PARTY_INCLUDES });
    if (!escrow) {
      res.status(404).json({ success: false, message: "Escrow not found" });
      return;
    }

    res.status(200).json({ success: true, data: escrow });
  } catch (error) {
    console.error("Get escrow dispute detail error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default {
  getAllDisputes,
  getDisputeById,
};
