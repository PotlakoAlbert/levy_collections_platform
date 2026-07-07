/**
 * Inline job processor — runs job handlers immediately when Redis/workers are unavailable.
 * Used when SKIP_WORKERS=true or Redis connection fails.
 */

import type { Job } from "bullmq";
import { logger } from "../logger";

type JobHandler = (job: Job) => Promise<unknown>;

function fakeJob(queueName: string, data: unknown, id: string): Job {
  return { id, name: queueName, data } as Job;
}

let handlers: Record<string, JobHandler> | null = null;

async function loadHandlers(): Promise<Record<string, JobHandler>> {
  if (handlers) return handlers;

  const [
    { handleInterestJob },
    { handleWhatsAppJob },
    { handleDocumentJob },
    { handleAutoAdvanceJob },
    { handleReminderJob },
    { handleReportJob },
    { handlePaymentJob },
    { handleAIJob },
    { handleTestJob },
  ] = await Promise.all([
    import("./interest.job"),
    import("./whatsapp.job"),
    import("./document.job"),
    import("./auto-advance.job"),
    import("./reminder.job"),
    import("./report.job"),
    import("./payment.job"),
    import("./ai.job"),
    import("./test.job"),
  ]);

  handlers = {
    interest: handleInterestJob,
    whatsapp: handleWhatsAppJob,
    document: handleDocumentJob,
    "auto-advance": handleAutoAdvanceJob,
    reminder: handleReminderJob,
    report: handleReportJob,
    payment: handlePaymentJob,
    ai: handleAIJob,
    test: handleTestJob,
  };

  return handlers;
}

export async function processInlineJob(queueName: string, data: unknown, jobId?: string) {
  const jobHandlers = await loadHandlers();
  const handler = jobHandlers[queueName];
  if (!handler) {
    throw new Error(`No inline handler registered for queue: ${queueName}`);
  }

  const id = jobId ?? `inline-${queueName}-${Date.now()}`;
  logger.info({ queueName, jobId: id }, "[INLINE] Processing job");

  try {
    const result = await handler(fakeJob(queueName, data, id));
    logger.info({ queueName, jobId: id }, "[INLINE] Job completed");
    return { id, result };
  } catch (error) {
    logger.error({ err: error, queueName, jobId: id }, "[INLINE] Job failed");
    throw error;
  }
}
