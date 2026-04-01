import { Request, Response, RequestHandler } from "express";
import Models from "../database/models";
import { Op, fn, col, literal } from "sequelize";

// GET /api/v1/admin/analytics/platform
// Returns a rich platform-wide analytics summary
export const getPlatformAnalytics: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { range = "30d" } = req.query;
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case "7d":   startDate = new Date(now.getTime() - 7 * 864e5); break;
      case "30d":  startDate = new Date(now.getTime() - 30 * 864e5); break;
      case "90d":  startDate = new Date(now.getTime() - 90 * 864e5); break;
      case "12m":  startDate = new Date(now.getTime() - 365 * 864e5); break;
      default:     startDate = new Date(now.getTime() - 30 * 864e5);
    }

    const dateFilter = { createdAt: { [Op.gte]: startDate } };

    // Run all queries in parallel
    const [
      // User stats
      totalUsers,
      verifiedUsers,
      newUsersInRange,

      // Organization stats
      totalOrgs,
      activeOrgs,
      pendingOrgs,

      // Group stats
      totalGroups,
      fundraisingGroups,
      groupsWithWallets,

      // Transaction stats
      txInRange,
      txByType,
      txByStatus,

      // Wallet stats
      totalWallets,
      activeWallets,
      totalBalanceResult,

      // Notification stats
      totalNotifications,
      unreadNotifications,

      // Top sender wallets
      topSenders,

      // Daily transaction volume (last 30d buckets)
      dailyVolume,
    ] = await Promise.all([
      models.User.count(),
      models.User.count({ where: { isVerified: true } }),
      models.User.count({ where: dateFilter }),

      models.Organization.count(),
      models.Organization.count({ where: { status: "active" } }),
      models.Organization.count({ where: { status: "pending" } }),

      models.Group.count(),
      models.Group.count({ where: { hasFundraising: true } }),
      models.Group.count({ where: { walletId: { [Op.not]: null } as any } }),

      models.Transaction.count({ where: { ...dateFilter, status: "completed" } }),
      models.Transaction.findAll({
        where: { ...dateFilter, status: "completed" },
        attributes: ["type", [fn("COUNT", col("id")), "count"], [fn("SUM", col("amount")), "volume"]],
        group: ["type"],
        raw: true,
      }),
      models.Transaction.findAll({
        where: dateFilter,
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),

      models.Wallet.count(),
      models.Wallet.count({ where: { isActive: true } }),
      models.Wallet.findAll({ attributes: [[fn("SUM", col("balance")), "total"]], raw: true }),

      models.Notification.count(),
      models.Notification.count({ where: { isRead: false } }),

      // Top 5 wallets by total sent
      models.Transaction.findAll({
        where: { ...dateFilter, status: "completed" },
        attributes: ["senderWalletId", [fn("SUM", col("amount")), "totalSent"], [fn("COUNT", col("id")), "txCount"]],
        group: ["senderWalletId"],
        order: [[literal('"totalSent"'), "DESC"]],
        limit: 5,
        raw: true,
      }),

      // Daily volume for chart — group by date truncated to day
      models.Transaction.findAll({
        where: { ...dateFilter, status: "completed" },
        attributes: [
          [fn("DATE_TRUNC", "day", col("createdAt")), "day"],
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("amount")), "volume"],
        ],
        group: [fn("DATE_TRUNC", "day", col("createdAt"))],
        order: [[fn("DATE_TRUNC", "day", col("createdAt")), "ASC"]],
        raw: true,
      }),
    ]);

    const totalBalance = Number((totalBalanceResult as any)[0]?.total ?? 0);

    // Build transaction type map
    const txTypeMap: Record<string, { count: number; volume: number }> = {};
    (txByType as any[]).forEach((row: any) => {
      txTypeMap[row.type] = { count: Number(row.count), volume: Number(row.volume) };
    });

    // Build status map
    const txStatusMap: Record<string, number> = {};
    (txByStatus as any[]).forEach((row: any) => {
      txStatusMap[row.status] = Number(row.count);
    });

    res.status(200).json({
      success: true,
      data: {
        range,
        generatedAt: new Date().toISOString(),
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers,
          newInRange: newUsersInRange,
          verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
        },
        organizations: {
          total: totalOrgs,
          active: activeOrgs,
          pending: pendingOrgs,
          inactive: totalOrgs - activeOrgs - pendingOrgs,
        },
        groups: {
          total: totalGroups,
          fundraising: fundraisingGroups,
          withWallets: groupsWithWallets,
          standard: totalGroups - fundraisingGroups,
        },
        transactions: {
          completedInRange: txInRange,
          byType: txTypeMap,
          byStatus: txStatusMap,
          totalVolume: Object.values(txTypeMap).reduce((s, t) => s + t.volume, 0),
        },
        wallets: {
          total: totalWallets,
          active: activeWallets,
          inactive: totalWallets - activeWallets,
          totalBalance,
          topSenders: (topSenders as any[]).map((row: any) => ({
            walletId: row.senderWalletId,
            totalSent: Number(row.totalSent),
            txCount: Number(row.txCount),
          })),
        },
        notifications: {
          total: totalNotifications,
          unread: unreadNotifications,
        },
        charts: {
          dailyVolume: (dailyVolume as any[]).map((row: any) => ({
            day: new Date(row.day).toISOString().slice(0, 10),
            count: Number(row.count),
            volume: Number(row.volume),
          })),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error fetching platform analytics", error: error.message });
  }
};

export default { getPlatformAnalytics };
