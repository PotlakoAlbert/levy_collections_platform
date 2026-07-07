import { Worker } from "bullmq";
import { redisConnection } from "../queue";
import { createInterestWorker } from "./interest.worker";
import { createWhatsAppWorker } from "./whatsapp.worker";
import { createDocumentWorker } from "./document.worker";
import { createAutoAdvanceWorker } from "./auto-advance.worker";
import { createReportWorker } from "./report.worker";

export function startWorkers(): Worker[] {
  return [
    createInterestWorker(redisConnection),
    createWhatsAppWorker(redisConnection),
    createDocumentWorker(redisConnection),
    createAutoAdvanceWorker(redisConnection),
    createReportWorker(redisConnection),
  ];
}
