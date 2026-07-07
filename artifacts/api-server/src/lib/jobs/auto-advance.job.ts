import { Job } from "bullmq";
import { db, mattersTable, communicationsTable, paymentsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { logger } from "../logger";
import { aiService } from "../ai/ai.service";

/**
 * Auto-advance worker job
 * Evaluates advancement conditions and auto-advances matter stages
 */
export async function handleAutoAdvanceJob(job: Job) {
  logger.info(`[AUTO-ADVANCE WORKER] Processing auto-advance for matter ${job.data.matterId}`);

  try {
    const { matterId } = job.data;

    if (!matterId) {
      logger.warn(`[AUTO-ADVANCE WORKER] No matterId provided`);
      return { success: false, error: "matterId required" };
    }

    // Get matter details
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, matterId));

    if (!matter) {
      logger.warn(`[AUTO-ADVANCE WORKER] Matter not found: ${matterId}`);
      return { success: false, error: "matter not found", matterId };
    }

    // Check if matter is eligible for advancement (only active matters in collection stage)
    if (matter.status !== "ACTIVE" || matter.stage === "CLOSED") {
      logger.info(
        `[AUTO-ADVANCE WORKER] Matter ${matter.reference} not eligible (status: ${matter.status}, stage: ${matter.stage})`
      );
      return { success: true, matterId, advanced: false, reason: "not eligible" };
    }

    // Calculate days in current stage
    const stageStartDate = matter.lodDate || matter.createdAt;
    const daysInStage = Math.floor(
      (new Date().getTime() - stageStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Fetch real communication history to determine responsiveness
    const communications = await db
      .select()
      .from(communicationsTable)
      .where(eq(communicationsTable.matterId, matterId));

    const lastCommunicationDate = communications.length > 0
      ? new Date(communications[communications.length - 1].sentAt!)
      : null;
    const lastContactDaysAgo = lastCommunicationDate
      ? Math.floor((new Date().getTime() - lastCommunicationDate.getTime()) / (1000 * 60 * 60 * 24))
      : daysInStage;

    // Determine responsiveness based on recent communication frequency
    const recentCommunications = communications.filter(c => {
      const commDate = new Date(c.sentAt!);
      return commDate > new Date(new Date().getTime() - 14 * 24 * 60 * 60 * 1000);
    });
    const responsiveness: "LOW" | "MEDIUM" | "HIGH" | "NONE" = recentCommunications.length >= 3 ? "HIGH" : recentCommunications.length >= 1 ? "MEDIUM" : "LOW";

    // Fetch payment history to assess payment behavior
    const paymentHistory = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.matterId, matterId));

    // Evaluate advancement criteria using AI with real schema
    const matterData = {
      matterId: matter.id,
      currentStage: matter.stage,
      daysInStage,
      lastContactDaysAgo,
      responsiveness,
      outstandingBalance: parseFloat(matter.capitalArrears) + parseFloat(matter.interest),
      interestAccrual: parseFloat(matter.interest),
      paymentHistory: paymentHistory.map(p => p.createdAt.toISOString()),
      previousOffers: [], // Would come from bot conversation states
    };

    const recommendation = await aiService.recommendStageAdvancement(matterData);

    if (!recommendation.shouldAdvance) {
      logger.info(
        `[AUTO-ADVANCE WORKER] Advancement not warranted: ${recommendation.reasoning}`
      );
      return {
        success: true,
        matterId,
        advanced: false,
        reason: recommendation.reasoning,
      };
    }

    // Update matter stage
    const nextStage = recommendation.nextStage;
    
    if (!nextStage) {
      logger.info(
        `[AUTO-ADVANCE WORKER] Cannot advance: no valid nextStage returned`
      );
      return { success: true, matterId, advanced: false, reason: "no valid next stage" };
    }
    
    await db
      .update(mattersTable)
      .set({
        stage: nextStage,
        updatedAt: new Date(),
      })
      .where(eq(mattersTable.id, matterId));

    logger.info(
      `[AUTO-ADVANCE WORKER] Advanced ${matter.reference} from ${matter.stage} to ${nextStage} (confidence: ${recommendation.confidence})`
    );

    return {
      success: true,
      matterId,
      advanced: true,
      fromStage: matter.stage,
      toStage: nextStage,
      confidence: recommendation.confidence,
    };
  } catch (error) {
    logger.error({ err: error }, `[AUTO-ADVANCE WORKER] Error processing auto-advance`);
    throw error;
  }
}
