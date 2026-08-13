import cron from "node-cron";
import { Op, Transaction as DbTransaction } from "sequelize";
import database_models from "../database/config/db.config";
import { releaseEscrowFunds } from "../services/escrowService";
import { notifyPaymentReceived, notifyPaymentSent } from "../utils/notificationHelpers";
import { Application } from "express";

const { sequelize, Escrow, User } = database_models as any;

const AUTO_RELEASE_BATCH_SIZE = 50;

/**
 * Auto-releases held escrows whose autoReleaseAt has passed with no dispute raised.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED so this stays correct if the backend ever
 * runs as multiple instances, same as the scheduled-transfer execution poller.
 */
const runAutoReleasePoll = async (app: Application): Promise<void> => {
  try {
    const dueEscrows = await Escrow.findAll({
      where: {
        status: "held",
        releaseMode: "auto_timeout",
        autoReleaseAt: { [Op.lte]: new Date() },
      },
      limit: AUTO_RELEASE_BATCH_SIZE,
    });

    for (const dueEscrow of dueEscrows) {
      await autoReleaseOne(app, dueEscrow.id);
    }
  } catch (error) {
    console.error("[escrows] Auto-release poll failed:", error);
  }
};

const autoReleaseOne = async (app: Application, escrowId: string): Promise<void> => {
  let released: any = null;
  let transactionId: string | null = null;

  try {
    await sequelize.transaction(async (t: DbTransaction) => {
      const escrow = await Escrow.findByPk(escrowId, { lock: t.LOCK.UPDATE, skipLocked: true, transaction: t });
      if (!escrow || escrow.status !== "held") return;

      const result = await releaseEscrowFunds(escrow, t);
      await escrow.update(
        { status: "released", releasedAt: new Date(), releaseTransactionId: result.transactionId },
        { transaction: t }
      );
      released = escrow;
      transactionId = result.transactionId;
    });
  } catch (error) {
    console.error(`[escrows] Auto-release failed for escrow ${escrowId}:`, error);
    return;
  }

  if (!released || !transactionId) return;

  const [payerUser, payeeUser] = await Promise.all([
    User.findByPk(released.payerUserId),
    User.findByPk(released.payeeUserId),
  ]);
  const amount = parseFloat(released.amount.toString());

  if (payeeUser && payerUser) {
    await notifyPaymentReceived(app, released.payeeUserId, transactionId, amount, released.currency, `${payerUser.firstName} ${payerUser.lastName}`);
    await notifyPaymentSent(app, released.payerUserId, transactionId, amount, released.currency, `${payeeUser.firstName} ${payeeUser.lastName}`);
  }
};

export const initEscrowJobs = (app: Application): void => {
  cron.schedule("*/5 * * * *", () => {
    void runAutoReleasePoll(app);
  });

  console.log("✅ Escrow jobs initialized (auto-release: every 5 minutes)");
};
