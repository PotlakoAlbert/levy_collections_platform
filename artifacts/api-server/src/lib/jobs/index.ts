import { Worker } from "bullmq";
import { logger } from "../logger";
import { handleTestJob } from "./test.job";
import { handleInterestJob } from "./interest.job";
import { handleWhatsAppJob } from "./whatsapp.job";
import { handleDocumentJob } from "./document.job";
import { handleAutoAdvanceJob } from "./auto-advance.job";
import { handleReminderJob } from "./reminder.job";
import { handleReportJob } from "./report.job";
import { handlePaymentJob } from "./payment.job";
import { handleAIJob } from "./ai.job";
import { redisConnection } from "../queue";
import { logJobStarted } from "../activity-log.service";

// Map job handlers to queue names
const jobHandlers: Record<string, (job: any) => Promise<any>> = {
  test: handleTestJob,
  interest: handleInterestJob,
  whatsapp: handleWhatsAppJob,
  document: handleDocumentJob,
  "auto-advance": handleAutoAdvanceJob,
  reminder: handleReminderJob,
  report: handleReportJob,
  payment: handlePaymentJob,
  ai: handleAIJob,
};

// Array to store active workers
let activeWorkers: Worker[] = [];

/**
 * Initialize all workers
 * This should be called after the Express server starts
 */
export async function initializeWorkers() {
  logger.info("Initializing workers...");

  for (const [queueName, handler] of Object.entries(jobHandlers)) {
    try {
      const worker = new Worker(queueName, handler, {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 jobs concurrently per worker
        removeOnComplete: {
          age: 3600, // Remove completed jobs after 1 hour
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours for debugging
        },
      });

      worker.on("active", async (job) => {
        logger.debug(`Worker ${queueName}: Job ${job.id} started`);
        if (job?.data?.debtorId) {
          await logJobStarted(job.data.debtorId, job.data?.matterId ?? null, queueName, String(job.id), queueName, { data: job.data });
        }
      });

      worker.on("completed", (job) => {
        logger.debug(`Worker ${queueName}: Job ${job.id} completed`);
      });

      worker.on("failed", (job, err) => {
        logger.error({ err: err, error: err?.message, stack: err?.stack }, `Worker ${queueName}: Job ${job?.id} failed`);
      });

      worker.on("error", (err) => {
        logger.error({ err: err }, `Worker ${queueName}: Error`);
      });

      activeWorkers.push(worker);
      logger.info(`✓ Worker initialized for queue: ${queueName}`);
    } catch (error) {
      logger.error({ err: error }, `Failed to initialize worker for ${queueName}`);
    }
  }

  logger.info(`All ${activeWorkers.length} workers initialized`);
}

/**
 * Gracefully shutdown all workers
 */
export async function shutdownWorkers() {
  logger.info("Shutting down workers...");

  for (const worker of activeWorkers) {
    try {
      await worker.close();
    } catch (error) {
      logger.error({ err: error }, `Error closing worker`);
    }
  }

  activeWorkers = [];
  logger.info("All workers shut down");
}
