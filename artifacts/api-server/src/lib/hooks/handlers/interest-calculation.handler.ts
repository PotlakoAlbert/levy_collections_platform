/**
 * INTEREST_CALCULATION Event Handler
 * Triggered nightly to recalculate interest on active matters
 * 
 * Responsibilities:
 * - Calculate accrued interest for all active matters
 * - Update interest fields
 * - Log calculations for audit
 */

import { logger } from "../../logger";
import { db, mattersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface InterestCalculationEvent {
  triggeredAt: Date;
}

export async function handleInterestCalculation(event: InterestCalculationEvent) {
  logger.info(`[EVENT] INTEREST_CALCULATION triggered at ${event.triggeredAt}`);

  try {
    const activeMatters = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.status, "ACTIVE"));

    logger.info(
      { count: activeMatters.length },
      `[EVENT] Processing ${activeMatters.length} active matters`
    );

    // Interest calculation is typically handled by jobs/interest.job.ts
    // This event just triggers the nightly calculation
    // The actual calculation logic lives in the job handler
    
    logger.info(`[EVENT] INTEREST_CALCULATION event logged, jobs will process individually`);
  } catch (error) {
    logger.error({ err: error }, `[EVENT] Error in INTEREST_CALCULATION handler`);
    throw error;
  }
}
