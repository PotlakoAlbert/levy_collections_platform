import { Worker, Job } from "bullmq";
import { handleReportJob } from "../jobs/report.job";

export function createReportWorker(connection: any) {
  return new Worker("reports", (job: Job) => handleReportJob(job), {
    connection,
  });
}
