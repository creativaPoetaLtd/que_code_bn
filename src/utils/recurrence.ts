import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ScheduledTransferRecurrenceRule } from "../types/model";

dayjs.extend(utc);
dayjs.extend(timezone);

const SUPPORTED_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

export const validateRecurrenceRule = (
  rule: any
): { valid: boolean; error?: string } => {
  if (!rule) return { valid: true };

  if (!SUPPORTED_FREQUENCIES.includes(rule.frequency)) {
    return {
      valid: false,
      error: `Recurrence frequency must be one of: ${SUPPORTED_FREQUENCIES.join(", ")}`,
    };
  }

  if (rule.interval !== undefined && (!Number.isInteger(rule.interval) || rule.interval < 1)) {
    return { valid: false, error: "Recurrence interval must be a positive integer" };
  }

  if (rule.maxOccurrences !== undefined && (!Number.isInteger(rule.maxOccurrences) || rule.maxOccurrences < 1)) {
    return { valid: false, error: "maxOccurrences must be a positive integer" };
  }

  if (rule.endDate !== undefined && isNaN(new Date(rule.endDate).getTime())) {
    return { valid: false, error: "endDate must be a valid date" };
  }

  return { valid: true };
};

/**
 * Computes the next occurrence for a recurring transfer, in the series' own timezone,
 * so DST shifts and month lengths don't drift the intended calendar date.
 * Month/year overflow (e.g. Jan 31 -> Feb) is clamped to the last valid day of the target month,
 * rather than rolling over into the following month.
 */
export const computeNextRun = (
  current: Date,
  tz: string,
  rule: ScheduledTransferRecurrenceRule
): Date => {
  const interval = Math.max(1, rule.interval || 1);
  const zoned = dayjs(current).tz(tz);

  switch (rule.frequency) {
    case "daily":
      return zoned.add(interval, "day").toDate();

    case "weekly":
      return zoned.add(interval * 7, "day").toDate();

    case "monthly": {
      const originalDay = zoned.date();
      // Move months while pinned to day 1 to avoid native month-overflow (e.g. Jan 31 + 1mo -> Mar 3),
      // then clamp back onto the target month's real last day.
      const target = zoned.date(1).add(interval, "month");
      const daysInTarget = target.daysInMonth();
      return target.date(Math.min(originalDay, daysInTarget)).toDate();
    }

    case "yearly": {
      const originalDay = zoned.date();
      const target = zoned.date(1).add(interval, "year");
      const daysInTarget = target.daysInMonth();
      return target.date(Math.min(originalDay, daysInTarget)).toDate();
    }

    default:
      throw new Error(`Unsupported recurrence frequency: ${rule.frequency}`);
  }
};

/**
 * Whether a recurring series should stop after the given occurrence, based on its own end rule.
 */
export const isRecurrenceExhausted = (
  rule: ScheduledTransferRecurrenceRule,
  occurrenceCountAfterThisRun: number,
  nextRun: Date
): boolean => {
  if (rule.maxOccurrences && occurrenceCountAfterThisRun >= rule.maxOccurrences) {
    return true;
  }
  if (rule.endDate && nextRun.getTime() > new Date(rule.endDate).getTime()) {
    return true;
  }
  return false;
};
