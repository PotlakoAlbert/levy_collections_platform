import { Job } from "bullmq";
import { logger } from "../logger";

/**
 * Test job for verifying queue functionality
 */
export async function handleTestJob(job: Job) {
  logger.info({ ...job.data }, `[TEST JOB] Starting job ${job.id}`);

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result = {
    success: true,
    jobId: job.id,
    processedAt: new Date().toISOString(),
    data: job.data,
  };

  logger.info(result, `[TEST JOB] Completed job ${job.id}`);
  return result;
}
