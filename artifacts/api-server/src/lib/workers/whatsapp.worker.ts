import { Worker, Job } from "bullmq";
import { handleWhatsAppJob } from "../jobs/whatsapp.job";

export function createWhatsAppWorker(connection: any) {
  return new Worker("whatsapp", (job: Job) => handleWhatsAppJob(job), {
    connection,
  });
}
