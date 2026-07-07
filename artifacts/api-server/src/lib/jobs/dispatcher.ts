import {
  interestQueue,
  whatsappQueue,
  documentQueue,
  reminderQueue,
  reportQueue,
  autoAdvanceQueue,
  paymentQueue,
  aiQueue,
} from "../queue";
import { logger } from "../logger";

export type JobType =
  | "interest"
  | "whatsapp"
  | "document"
  | "reminder"
  | "report"
  | "auto-advance"
  | "payment"
  | "ai";

interface EnqueueOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
  timeout?: number;
}

/**
 * Main dispatcher for enqueuing jobs
 * @param type Job type (interest, whatsapp, document, etc.)
 * @param data Job data payload
 * @param options BullMQ options (delay, priority, attempts, timeout)
 * @returns Promise with job ID
 */
export async function enqueueJob(type: JobType, data: any, options: EnqueueOptions = {}) {
  const queueMap: Record<JobType, typeof interestQueue> = {
    interest: interestQueue,
    whatsapp: whatsappQueue,
    document: documentQueue,
    reminder: reminderQueue,
    report: reportQueue,
    "auto-advance": autoAdvanceQueue,
    payment: paymentQueue,
    ai: aiQueue,
  };

  const queue = queueMap[type];
  if (!queue) {
    throw new Error(`Unknown job type: ${type}`);
  }

  const jobName = `${type}-${Date.now()}`;
  const job = await queue.add(jobName, data, {
    delay: options.delay ?? undefined,
    priority: options.priority ?? 0,
    attempts: options.attempts ?? 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2 seconds initial
    },
    removeOnComplete: {
      age: 3600, // Remove completed jobs after 1 hour
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  });

  logger.info({
    jobType: type,
    jobId: job.id,
    queueLength: await queue.count(),
  }, `[DISPATCHER] Job enqueued`);

  return job;
}

/**
 * Enqueue an interest calculation job
 * @param matterId Matter ID to recalculate interest for
 */
export async function enqueueInterestJob(matterId: string) {
  return enqueueJob("interest", { matterId }, { priority: 10 });
}

/**
 * Enqueue a WhatsApp message job
 * @param debtorPhone Phone number to send to
 * @param message Message content
 * @param matterId Related matter ID
 */
export async function enqueueWhatsAppJob(debtorPhone: string, message: string, matterId: string) {
  return enqueueJob("whatsapp", { debtorPhone, message, matterId }, { priority: 8 });
}

/**
 * Enqueue a document generation job
 * @param matterId Matter ID
 * @param documentType Type of document (LOD, S129, etc.)
 */
export async function enqueueDocumentJob(matterId: string, documentType: string) {
  return enqueueJob("document", { matterId, documentType }, { priority: 7 });
}

/**
 * Enqueue a payment reminder job
 * @param matterId Matter ID to send reminder for
 */
export async function enqueueReminderJob(matterId: string) {
  return enqueueJob("reminder", { matterId }, { priority: 5 });
}

/**
 * Enqueue a report generation job
 * @param reportType Type of report (weekly, daily, etc.)
 */
export async function enqueueReportJob(reportType: string) {
  return enqueueJob("report", { reportType }, { priority: 3, delay: 60000 }); // 1 min delay
}

/**
 * Enqueue an auto-advance check job
 * @param matterId Matter ID to check for advancement
 */
export async function enqueueAutoAdvanceJob(matterId: string) {
  return enqueueJob("auto-advance", { matterId }, { priority: 6 });
}

/**
 * Enqueue a payment allocation job
 * @param paymentId Payment ID to process
 * @param matterId Matter ID
 */
export async function enqueuePaymentJob(paymentId: string, matterId: string) {
  return enqueueJob("payment", { paymentId, matterId }, { priority: 9 });
}

/**
 * Enqueue an AI task job
 * @param task AI task type
 * @param data Task data
 */
export async function enqueueAIJob(task: string, data: any) {
  return enqueueJob("ai", { task, data }, { priority: 5 });
}

/**
 * Bulk enqueue jobs for a matter creation event
 * @param matterId New matter ID
 * @param debtorPhone Debtor phone number
 */
export async function enqueueMatterCreationJobs(matterId: string, debtorPhone: string) {
  logger.info({ matterId }, `[DISPATCHER] Enqueueing matter creation cascade`);

  const jobs = await Promise.all([
    enqueueDocumentJob(matterId, "LOD"),
    enqueueWhatsAppJob(debtorPhone, "Your matter has been registered.", matterId),
    enqueueInterestJob(matterId),
  ]);

  logger.info({
    matterId,
    jobsEnqueued: jobs.length,
  }, `[DISPATCHER] Matter creation cascade complete`);

  return jobs;
}
