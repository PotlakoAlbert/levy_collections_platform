import { Job } from "bullmq";
import { db, mattersTable, stageHistoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";
import { calculateInterest } from "../interest";

/**
 * Interest calculation worker job
 * Calculates and updates interest accrual for a specific matter
 * Runs nightly and on-demand
 */
export async function handleInterestJob(job: Job) {
  logger.info({ ...job.data }, `[INTEREST WORKER] Starting interest calculation`);

  try {
    const { matterId } = job.data;

    if (!matterId) {
      logger.warn(`[INTEREST WORKER] No matterId provided`);
      return { success: false, error: "matterId required" };
    }

    // Get matter details
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, matterId));

    if (!matter) {
      logger.warn(`[INTEREST WORKER] Matter not found: ${matterId}`);
      return { success: false, error: "matter not found", matterId };
    }

    // Calculate new interest since last calculation
    const capitalArrears = parseFloat(matter.capitalArrears);
    const fromDate = matter.interestFromDate || matter.createdAt;
    const toDate = new Date();

    const { interest: newInterest, days, rate } = await calculateInterest(
      capitalArrears,
      fromDate,
      toDate
    );

    const currentInterest = parseFloat(matter.interest);
    const totalInterest = currentInterest + newInterest;

    // Update matter with new interest
    await db
      .update(mattersTable)
      .set({
        interest: totalInterest.toString(),
        updatedAt: new Date(),
      })
      .where(eq(mattersTable.id, matterId));

    logger.info({
      matterId,
      reference: matter.reference,
      previousInterest: currentInterest,
      accrued: newInterest,
      totalInterest,
      rate: (rate * 100).toFixed(2) + "%",
      days,
    }, `[INTEREST WORKER] Calculated interest`);

    return {
      success: true,
      matterId,
      reference: matter.reference,
      previousInterest: currentInterest,
      accrued: newInterest,
      totalInterest,
      rate,
      days,
    };
  } catch (error) {
    logger.error({ err: error }, `[INTEREST WORKER] Error processing job`);
    throw error;
  }
}
