import { Job } from "bullmq";
import { logger } from "../logger";
import { aiService } from "../ai/ai.service";

/**
 * AI worker job
 * Routes and processes AI-powered tasks
 */
export async function handleAIJob(job: Job) {
  logger.info(`[AI WORKER] Processing AI task: ${job.data.task}`);

  try {
    const { task, data } = job.data;

    if (!task) {
      logger.warn(`[AI WORKER] No task type provided`);
      return { success: false, error: "task type required" };
    }

    let result: any;

    switch (task) {
      case "CLASSIFY_INTENT": {
        const intentResult = await aiService.classifyDebtorIntent(data?.message || "", data?.context);
        logger.info(
          `[AI WORKER] Intent classified as ${intentResult.intent} with confidence ${intentResult.confidence}`
        );
        result = intentResult;
        break;
      }

      case "DRAFT_DOCUMENT": {
        const docResult = await aiService.draftDocumentContent(
          data?.documentType || "GENERAL",
          data?.matterDetails
        );
        logger.info(
          `[AI WORKER] Document drafted with ${docResult.wordCount} words`
        );
        result = docResult;
        break;
      }

      case "RECOMMEND_ADVANCEMENT": {
        const advanceResult = await aiService.recommendStageAdvancement(data?.matterData);
        logger.info(
          `[AI WORKER] Advancement recommendation: ${advanceResult.shouldAdvance ? "YES" : "NO"}`
        );
        result = advanceResult;
        break;
      }

      case "GENERATE_ARRANGEMENT": {
        const arrangementResult = await aiService.generatePaymentArrangement(
          data?.negotiationContext
        );
        logger.info(
          `[AI WORKER] Payment arrangement proposed: R${arrangementResult.proposedAmount}`
        );
        result = arrangementResult;
        break;
      }

      default:
        logger.warn(`[AI WORKER] Unknown AI task: ${task}`);
        return { success: false, error: `unknown task: ${task}` };
    }

    return {
      success: true,
      task,
      result,
    };
  } catch (error) {
    logger.error({ err: error }, `[AI WORKER] Error processing AI task`);
    throw error;
  }
}
