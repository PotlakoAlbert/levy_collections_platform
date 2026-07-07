import { Worker, Job } from "bullmq";
import { handleAutoAdvanceJob } from "../jobs/auto-advance.job";

export function createAutoAdvanceWorker(connection: any) {
  return new Worker("auto-advance", (job: Job) => handleAutoAdvanceJob(job), {
    connection,
  });
}
