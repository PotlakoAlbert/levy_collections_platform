import { Worker, Job } from "bullmq";
import { handleDocumentJob } from "../jobs/document.job";

export function createDocumentWorker(connection: any) {
  return new Worker("document", (job: Job) => handleDocumentJob(job), {
    connection,
  });
}
