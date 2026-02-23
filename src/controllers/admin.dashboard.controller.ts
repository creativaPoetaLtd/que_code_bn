import { Response } from "express";
import { Op } from "sequelize";
import Models from "../database/models";
import { AuthRequest } from "../middleware/auth.unified.middleware";

type RangeKey = "today" | "7d" | "30d" | "90d" | "12m" | "custom";
type BucketType = "hour" | "day" | "month";

interface DateRangeConfig {
  key: RangeKey;
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  bucket: BucketType;
}

interface BucketItem {
  key: string;
  label: string;
}

interface TxLite {
  amount: string | number;
  status: string;
  type: string;
  createdAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toDateOnly = (value: Date): string => {
  return value.toISOString().slice(0, 10);
};

const parseCustomDate = (input?: string, endOfDay = false): Date | null => {
  if (!input) return null;

  const fromIso = new Date(input);
  if (!Number.isNaN(fromIso.getTime())) {
    if (input.length <= 10) {
      fromIso.setUTCHours(
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
      );
    }
    return fromIso;
  }

  return null;
};

const getDateBucketKey = (date: Date, bucket: BucketType): string => {
  if (bucket === "hour") {
    return `${toDateOnly(date)} ${String(date.getUTCHours()).padStart(2, "0")}`;
  }

  if (bucket === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return toDateOnly(date);
};

const getDateBucketLabel = (
  date: Date,
  bucket: BucketType,
  totalBuckets: number,
): string => {
  if (bucket === "hour") {
    return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
  }

  if (bucket === "month") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }

  if (totalBuckets <= 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const generateBuckets = (
  startDate: Date,
  endDate: Date,
  bucket: BucketType,
): BucketItem[] => {
  const buckets: BucketItem[] = [];

  if (bucket === "month") {
    const cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        1,
        0,
        0,
        0,
        0,
      ),
    );
    const endCursor = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1, 0, 0, 0, 0),
    );

    while (cursor <= endCursor) {
      const key = getDateBucketKey(cursor, bucket);
      buckets.push({ key, label: getDateBucketLabel(cursor, bucket, 0) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return buckets;
  }

  if (bucket === "hour") {
    const cursor = new Date(startDate);
    cursor.setUTCMinutes(0, 0, 0);

    while (cursor <= endDate) {
      const key = getDateBucketKey(cursor, bucket);
      buckets.push({ key, label: getDateBucketLabel(cursor, bucket, 0) });
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }

    return buckets;
  }

  const cursor = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const last = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  while (cursor <= last) {
    const key = getDateBucketKey(cursor, bucket);
    buckets.push({ key, label: "" });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets.map((bucketItem) => {
    const date = new Date(`${bucketItem.key}T00:00:00.000Z`);
    return {
      ...bucketItem,
      label: getDateBucketLabel(date, bucket, buckets.length),
    };
  });
};

const computeTrendPercent = (
  currentValue: number,
  previousValue: number,
): number => {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }

  return Number(
    (((currentValue - previousValue) / previousValue) * 100).toFixed(2),
  );
};

const computeRatePercent = (numerator: number, denominator: number): number => {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const resolveDateRange = (query: AuthRequest["query"]): DateRangeConfig => {
  const now = new Date();
  const rangeRaw = String(query.range || "7d").toLowerCase();
  const supportedRanges: RangeKey[] = [
    "today",
    "7d",
    "30d",
    "90d",
    "12m",
    "custom",
  ];
  const rangeKey: RangeKey = supportedRanges.includes(rangeRaw as RangeKey)
    ? (rangeRaw as RangeKey)
    : "7d";

  let startDate = new Date(now.getTime() - 6 * DAY_MS);
  let endDate = new Date(now);

  if (rangeKey === "today") {
    startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setUTCHours(23, 59, 59, 999);
  } else if (rangeKey === "7d") {
    startDate = new Date(now.getTime() - 6 * DAY_MS);
  } else if (rangeKey === "30d") {
    startDate = new Date(now.getTime() - 29 * DAY_MS);
  } else if (rangeKey === "90d") {
    startDate = new Date(now.getTime() - 89 * DAY_MS);
  } else if (rangeKey === "12m") {
    startDate = new Date(now);
    startDate.setUTCMonth(startDate.getUTCMonth() - 11);
    startDate.setUTCDate(1);
    startDate.setUTCHours(0, 0, 0, 0);
  } else if (rangeKey === "custom") {
    const customStart = parseCustomDate(query.startDate as string, false);
    const customEnd = parseCustomDate(query.endDate as string, true);

    if (!customStart || !customEnd || customStart > customEnd) {
      throw new Error(
        "Invalid custom date range. Use startDate/endDate in ISO format.",
      );
    }

    startDate = customStart;
    endDate = customEnd;
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - durationMs);

  const requestedBucket = String(query.bucket || "").toLowerCase();
  const durationDays = Math.max(1, Math.ceil((durationMs + 1) / DAY_MS));

  let bucket: BucketType;
  if (
    requestedBucket === "hour" ||
    requestedBucket === "day" ||
    requestedBucket === "month"
  ) {
    bucket = requestedBucket;
  } else if (durationDays <= 2) {
    bucket = "hour";
  } else if (durationDays <= 120) {
    bucket = "day";
  } else {
    bucket = "month";
  }

  return {
    key: rangeKey,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    bucket,
  };
};

export const getDashboardStatistics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const range = resolveDateRange(req.query);
    const models = req.app.get("models") as ReturnType<typeof Models>;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers,
      verifiedUsers,
      totalOrganizations,
      pendingOrganizations,
      totalWallets,
      activeWallets,
      usersCurrent,
      usersPrevious,
      orgsCurrent,
      orgsPrevious,
      actionsCurrent,
      actionsPrevious,
      actionsToday,
      txCurrentRowsRaw,
      txPreviousRowsRaw,
      txTodayRowsRaw,
      userCreatedRowsRaw,
      orgCreatedRowsRaw,
    ] = await Promise.all([
      models.User.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.User.count({
        where: {
          isVerified: true,
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Organization.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Organization.count({
        where: {
          status: "pending",
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Wallet.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Wallet.count({
        where: {
          isActive: true,
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.User.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.User.count({
        where: {
          createdAt: {
            [Op.between]: [range.previousStartDate, range.previousEndDate],
          },
        },
      }),
      models.Organization.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Organization.count({
        where: {
          createdAt: {
            [Op.between]: [range.previousStartDate, range.previousEndDate],
          },
        },
      }),
      models.Action.count({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
      }),
      models.Action.count({
        where: {
          createdAt: {
            [Op.between]: [range.previousStartDate, range.previousEndDate],
          },
        },
      }),
      models.Action.count({
        where: { createdAt: { [Op.between]: [todayStart, now] } },
      }),
      models.Transaction.findAll({
        attributes: ["amount", "status", "type", "createdAt"],
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
        raw: true,
      }),
      models.Transaction.findAll({
        attributes: ["amount", "status", "type", "createdAt"],
        where: {
          createdAt: {
            [Op.between]: [range.previousStartDate, range.previousEndDate],
          },
        },
        raw: true,
      }),
      models.Transaction.findAll({
        attributes: ["amount", "status", "type", "createdAt"],
        where: { createdAt: { [Op.between]: [todayStart, now] } },
        raw: true,
      }),
      models.User.findAll({
        attributes: ["createdAt"],
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
        raw: true,
      }),
      models.Organization.findAll({
        attributes: ["createdAt"],
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
        raw: true,
      }),
    ]);

    const txCurrentRows = txCurrentRowsRaw as unknown as TxLite[];
    const txPreviousRows = txPreviousRowsRaw as unknown as TxLite[];
    const txTodayRows = txTodayRowsRaw as unknown as TxLite[];
    const userCreatedRows = userCreatedRowsRaw as unknown as Array<{
      createdAt: Date;
    }>;
    const orgCreatedRows = orgCreatedRowsRaw as unknown as Array<{
      createdAt: Date;
    }>;

    const amountCurrent = txCurrentRows.reduce(
      (sum, tx) => sum + toNumber(tx.amount),
      0,
    );
    const amountPrevious = txPreviousRows.reduce(
      (sum, tx) => sum + toNumber(tx.amount),
      0,
    );

    const completedCurrent = txCurrentRows.filter(
      (tx) => tx.status === "completed",
    );
    const completedPrevious = txPreviousRows.filter(
      (tx) => tx.status === "completed",
    );
    const failedCurrentCount = txCurrentRows.filter(
      (tx) => tx.status === "failed" || tx.status === "cancelled",
    ).length;
    const failedPreviousCount = txPreviousRows.filter(
      (tx) => tx.status === "failed" || tx.status === "cancelled",
    ).length;

    const riskCurrentRate = computeRatePercent(
      failedCurrentCount,
      txCurrentRows.length,
    );
    const riskPreviousRate = computeRatePercent(
      failedPreviousCount,
      txPreviousRows.length,
    );

    const buckets = generateBuckets(
      range.startDate,
      range.endDate,
      range.bucket,
    );
    const bucketIndex = new Map<string, number>();
    buckets.forEach((item, index) => {
      bucketIndex.set(item.key, index);
    });

    const transactionsSeries = new Array<number>(buckets.length).fill(0);
    const disputesSeries = new Array<number>(buckets.length).fill(0);
    const volumeSeries = new Array<number>(buckets.length).fill(0);
    const usersSeries = new Array<number>(buckets.length).fill(0);
    const orgsSeries = new Array<number>(buckets.length).fill(0);
    const flowTypeSeries: Record<string, number[]> = {
      transfer: new Array<number>(buckets.length).fill(0),
      payment: new Array<number>(buckets.length).fill(0),
      donation: new Array<number>(buckets.length).fill(0),
      vote: new Array<number>(buckets.length).fill(0),
      topup: new Array<number>(buckets.length).fill(0),
      withdrawal: new Array<number>(buckets.length).fill(0),
    };

    txCurrentRows.forEach((tx) => {
      const createdAt = new Date(tx.createdAt);
      const key = getDateBucketKey(createdAt, range.bucket);
      const index = bucketIndex.get(key);

      if (index === undefined) return;

      transactionsSeries[index] += 1;
      volumeSeries[index] += toNumber(tx.amount);

      if (tx.status === "failed" || tx.status === "cancelled") {
        disputesSeries[index] += 1;
      }

      if (flowTypeSeries[tx.type]) {
        flowTypeSeries[tx.type][index] += 1;
      }
    });

    userCreatedRows.forEach((user) => {
      const key = getDateBucketKey(new Date(user.createdAt), range.bucket);
      const index = bucketIndex.get(key);
      if (index !== undefined) usersSeries[index] += 1;
    });

    orgCreatedRows.forEach((org) => {
      const key = getDateBucketKey(new Date(org.createdAt), range.bucket);
      const index = bucketIndex.get(key);
      if (index !== undefined) orgsSeries[index] += 1;
    });

    const riskSeries = transactionsSeries.map((txCount, index) =>
      computeRatePercent(disputesSeries[index], txCount),
    );

    const todayTransactions = txTodayRows.length;
    const todayDisputes = txTodayRows.filter(
      (tx) => tx.status === "failed" || tx.status === "cancelled",
    ).length;

    const responsePayload = {
      range: {
        key: range.key,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        previousStartDate: range.previousStartDate.toISOString(),
        previousEndDate: range.previousEndDate.toISOString(),
        bucket: range.bucket,
      },
      kpis: {
        totalUsers: {
          total: totalUsers,
          verified: verifiedUsers,
          newInRange: usersCurrent,
          trendPercent: computeTrendPercent(usersCurrent, usersPrevious),
        },
        organizations: {
          total: totalOrganizations,
          pending: pendingOrganizations,
          newInRange: orgsCurrent,
          trendPercent: computeTrendPercent(orgsCurrent, orgsPrevious),
        },
        volume: {
          totalInRange: Number(amountCurrent.toFixed(2)),
          completedInRange: Number(
            completedCurrent
              .reduce((sum, tx) => sum + toNumber(tx.amount), 0)
              .toFixed(2),
          ),
          trendPercent: computeTrendPercent(amountCurrent, amountPrevious),
        },
        riskFraud: {
          flaggedCount: failedCurrentCount,
          ratePercent: riskCurrentRate,
          trendPoints: Number((riskCurrentRate - riskPreviousRate).toFixed(2)),
        },
      },
      counts: {
        wallets: {
          total: totalWallets,
          active: activeWallets,
        },
        transactions: {
          total: txCurrentRows.length,
          completed: completedCurrent.length,
          pending: txCurrentRows.filter((tx) => tx.status === "pending").length,
          failedOrCancelled: failedCurrentCount,
        },
        actions: {
          createdToday: actionsToday,
          createdInRange: actionsCurrent,
          trendPercent: computeTrendPercent(actionsCurrent, actionsPrevious),
        },
      },
      charts: {
        transactionsDisputes: {
          labels: buckets.map((item) => item.label),
          datasets: {
            transactions: transactionsSeries,
            disputes: disputesSeries,
          },
        },
        flowByType: {
          labels: buckets.map((item) => item.label),
          series: flowTypeSeries,
        },
        sparklines: {
          users: usersSeries,
          organizations: orgsSeries,
          volume: volumeSeries.map((value) => Number(value.toFixed(2))),
          risk: riskSeries,
        },
      },
      table: {
        flowSummary: [
          {
            key: "total_transactions",
            label: "Total transactions",
            today: todayTransactions,
            rangeTotal: txCurrentRows.length,
            trendPercent: computeTrendPercent(
              txCurrentRows.length,
              txPreviousRows.length,
            ),
            status: riskCurrentRate < 1 ? "Healthy" : "Monitor",
          },
          {
            key: "actions_created",
            label: "Actions created",
            today: actionsToday,
            rangeTotal: actionsCurrent,
            trendPercent: computeTrendPercent(actionsCurrent, actionsPrevious),
            status: "Normal",
          },
          {
            key: "new_organizations",
            label: "New organizations",
            today: orgCreatedRows.filter(
              (org) => new Date(org.createdAt) >= todayStart,
            ).length,
            rangeTotal: orgsCurrent,
            trendPercent: computeTrendPercent(orgsCurrent, orgsPrevious),
            status: pendingOrganizations > 0 ? "Review docs" : "Stable",
          },
          {
            key: "failed_or_blocked_rate",
            label: "Failed / blocked",
            today: computeRatePercent(todayDisputes, todayTransactions),
            rangeTotal: riskCurrentRate,
            trendPoints: Number(
              (riskCurrentRate - riskPreviousRate).toFixed(2),
            ),
            status: riskCurrentRate < 1 ? "OK" : "Monitor",
          },
        ],
      },
      meta: {
        generatedAt: new Date().toISOString(),
        currency: "RWF",
      },
    };

    res.status(200).json({
      success: true,
      data: responsePayload,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error fetching dashboard statistics";
    res.status(400).json({
      success: false,
      message,
    });
  }
};

export default {
  getDashboardStatistics,
};
