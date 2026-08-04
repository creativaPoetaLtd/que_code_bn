import cron from "node-cron";
import { Application } from "express";
import { Op } from "sequelize";
import database_models from "../database/config/db.config";
import {
  executeOccurrence,
  attemptHold,
  finalizeFailedOccurrence,
  ROLLING_HOLD_WINDOW_HOURS,
  STALE_EXECUTING_MINUTES,
} from "../services/scheduledTransferExecutionService";

const { sequelize, ScheduledTransfer } = database_models as any;

const EXECUTION_BATCH_SIZE = 50;
const HOLD_BATCH_SIZE = 50;

/**
 * Recovers rows a crashed process left stuck in 'executing'. Rows that already had
 * funds reserved (heldAmount set) go back to 'held' for a retry; rows that were being
 * processed as a missed, never-held occurrence go back to 'scheduled' instead - reclaiming
 * them as 'held' would be wrong, since no funds were ever actually set aside for them.
 */
const reclaimStaleExecutingRows = async (): Promise<void> => {
  const staleBefore = new Date(Date.now() - STALE_EXECUTING_MINUTES * 60000);

  const [heldCount] = await ScheduledTransfer.update(
    { status: "held" },
    {
      where: {
        status: "executing",
        heldAmount: { [Op.ne]: null },
        updatedAt: { [Op.lt]: staleBefore },
      },
    }
  );

  const [scheduledCount] = await ScheduledTransfer.update(
    { status: "scheduled" },
    {
      where: {
        status: "executing",
        heldAmount: null,
        updatedAt: { [Op.lt]: staleBefore },
      },
    }
  );

  if (heldCount > 0 || scheduledCount > 0) {
    console.warn(
      `[scheduled-transfers] Reclaimed ${heldCount} held + ${scheduledCount} missed row(s) stuck in 'executing'`
    );
  }
};

const claimRows = async (status: "held" | "scheduled"): Promise<string[]> => {
  return sequelize.transaction(async (t: any) => {
    const rows = await ScheduledTransfer.findAll({
      where: { status, scheduledFor: { [Op.lte]: new Date() } },
      limit: EXECUTION_BATCH_SIZE,
      lock: t.LOCK.UPDATE,
      skipLocked: true,
      transaction: t,
    });
    const ids = rows.map((r: any) => r.id);
    if (ids.length > 0) {
      await ScheduledTransfer.update(
        { status: "executing" },
        { where: { id: { [Op.in]: ids } }, transaction: t }
      );
    }
    return ids;
  });
};

const runExecutionPoll = async (app: Application): Promise<void> => {
  try {
    await reclaimStaleExecutingRows();

    // Due occurrences that already have funds reserved - the common path.
    const dueHeld = await claimRows("held");
    for (const id of dueHeld) {
      await executeOccurrence(app, id);
    }

    // Occurrences that reached their due date without ever successfully being held
    // (the rolling-hold job kept failing right up to the deadline).
    const missed = await claimRows("scheduled");
    for (const id of missed) {
      await finalizeFailedOccurrence(app, id, "Scheduled time passed before funds could be reserved");
    }
  } catch (error) {
    console.error("[scheduled-transfers] Execution poll failed:", error);
  }
};

const runRollingHoldPoll = async (app: Application): Promise<void> => {
  try {
    const windowEnd = new Date(Date.now() + ROLLING_HOLD_WINDOW_HOURS * 60 * 60 * 1000);
    const rows = await ScheduledTransfer.findAll({
      where: {
        status: "scheduled",
        scheduledFor: { [Op.gt]: new Date(), [Op.lte]: windowEnd },
      },
      limit: HOLD_BATCH_SIZE,
    });
    for (const row of rows) {
      await attemptHold(app, row.id);
    }
  } catch (error) {
    console.error("[scheduled-transfers] Rolling hold poll failed:", error);
  }
};

/**
 * Starts the scheduled-transfer background jobs. Uses SELECT ... FOR UPDATE SKIP LOCKED
 * to claim rows, so this stays correct even if the backend is ever run as multiple
 * instances - two pollers hitting the same due row simply split the work instead of
 * double-executing it.
 */
export const initScheduledTransferJobs = (app: Application): void => {
  cron.schedule("* * * * *", () => {
    void runExecutionPoll(app);
  });

  cron.schedule("0 * * * *", () => {
    void runRollingHoldPoll(app);
  });

  console.log("✅ Scheduled transfer jobs initialized (execution: every minute, hold reservation: hourly)");
};
