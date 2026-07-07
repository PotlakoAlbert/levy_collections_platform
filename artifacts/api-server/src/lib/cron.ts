/**
 * Cron Jobs for automated tasks
 * - Nightly (11 PM): Interest recalculation for all active matters
 * - Weekly (Mon 9 AM): Report generation
 * - Hourly: Auto-advance checks
 */

import cron from "node-cron";
import { logger } from "./logger";
import { emitEvent } from "./hooks/event-hooks";
import { db, mattersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { enqueueAutoAdvanceJob, enqueueReportJob } from "./jobs/dispatcher";

let cronJobs: cron.ScheduledTask[] = [];

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  logger.info("[CRON] Initializing cron jobs");

  // ============================================================================
  // NIGHTLY INTEREST CALCULATION (11 PM / 23:00)
  // ============================================================================
  const nightlyInterestJob = cron.schedule("0 23 * * *", async () => {
    logger.info("[CRON] Running nightly interest calculation");

    try {
      await emitEvent("INTEREST_CALCULATION", {
        triggeredAt: new Date(),
      });
      logger.info("[CRON] Nightly interest calculation completed");
    } catch (error) {
      logger.error({ err: error }, "[CRON] Error in nightly interest calculation");
    }
  });

  cronJobs.push(nightlyInterestJob);

  // ============================================================================
  // WEEKLY REPORT GENERATION (Monday 09:00)
  // ============================================================================
  const weeklyReportJob = cron.schedule("0 9 * * 1", async () => {
    logger.info("[CRON] Running weekly report generation");
    try {
      await enqueueReportJob("WEEKLY");
      logger.info("[CRON] Weekly report queued");
    } catch (error) {
      logger.error({ err: error }, "[CRON] Error queueing weekly report");
    }
  });

  cronJobs.push(weeklyReportJob);

  // ============================================================================
  // HOURLY AUTO-ADVANCE CHECK (Every hour at :00)
  // ============================================================================
  const hourlyAutoAdvanceJob = cron.schedule("0 * * * *", async () => {
    logger.info("[CRON] Running hourly auto-advance check");

    try {
      const activeMatters = await db
        .select({ id: mattersTable.id })
        .from(mattersTable)
        .where(eq(mattersTable.status, "ACTIVE"));

      for (const matter of activeMatters) {
        await enqueueAutoAdvanceJob(matter.id);
      }

      logger.info(
        { mattersQueued: activeMatters.length },
        "[CRON] Hourly auto-advance jobs queued"
      );
    } catch (error) {
      logger.error({ err: error }, "[CRON] Error in hourly auto-advance check");
    }
  });

  cronJobs.push(hourlyAutoAdvanceJob);

  logger.info(`[CRON] ${cronJobs.length} cron jobs initialized`);
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs() {
  logger.info("[CRON] Stopping all cron jobs");

  for (const job of cronJobs) {
    job.stop();
  }

  cronJobs = [];
  logger.info("[CRON] All cron jobs stopped");
}

export default {
  initializeCronJobs,
  stopCronJobs,
};
