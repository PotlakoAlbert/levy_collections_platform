import { Worker, Job } from "bullmq";
import { handleInterestJob } from "../jobs/interest.job";

export function createInterestWorker(connection: any) {
  return new Worker("interest", (job: Job) => handleInterestJob(job), {
    connection,
  });
}
