import { Request, Response, RequestHandler } from "express";
import Models from "../database/models";
import { Op } from "sequelize";

// GET /api/v1/admin/wallets — already served by /transactions/wallets/all
// This controller adds admin-specific actions: toggle status, manual adjustment

// PUT /api/v1/admin/wallets/:id/status — deactivate / reactivate
export const toggleWalletStatus: RequestHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const wallet = await models.Wallet.findByPk(id);
    if (!wallet) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }

    const newStatus = !wallet.isActive;
    await wallet.update({ isActive: newStatus });

    res.status(200).json({
      success: true,
      message: `Wallet ${newStatus ? "reactivated" : "deactivated"} successfully`,
      data: { id: wallet.id, isActive: newStatus },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error updating wallet status", error: error.message });
  }
};

// GET /api/v1/admin/wallets/:id — full wallet detail with owner info + recent transactions
export const getWalletDetail: RequestHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const wallet = await models.Wallet.findByPk(id, {
      include: [
        { model: models.User, as: "user", required: false, attributes: ["id", "firstName", "lastName", "email", "phone", "isVerified"] },
        { model: models.Organization, as: "organization", required: false, attributes: ["id", "name", "email", "status"] },
        { model: models.Group, as: "group", required: false, attributes: ["id", "name", "memberCount"] },
        { model: models.WalletRestriction, as: "restrictions", required: false, include: [{ model: models.Category, as: "category", attributes: ["id", "name"] }] },
      ],
    });

    if (!wallet) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }

    // Recent 10 transactions involving this wallet
    const recentTx = await models.Transaction.findAll({
      where: {
        [Op.or]: [{ senderWalletId: id }, { receiverWalletId: id }],
      },
      limit: 10,
      order: [["createdAt", "DESC"]],
      attributes: ["id", "amount", "type", "status", "createdAt", "description", "currency"],
    });

    // Stats
    const txStats = await models.Transaction.findAll({
      where: {
        [Op.or]: [{ senderWalletId: id }, { receiverWalletId: id }],
        status: "completed",
      },
      attributes: ["type", "amount", "senderWalletId"],
    });

    const totalIn = txStats
      .filter((t: any) => t.receiverWalletId === id || t.senderWalletId !== id)
      .reduce((s: number, t: any) => s + Number(t.amount), 0);

    res.status(200).json({
      success: true,
      data: {
        wallet,
        recentTransactions: recentTx,
        transactionCount: txStats.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching wallet detail", error: error.message });
  }
};

export default { toggleWalletStatus, getWalletDetail };
