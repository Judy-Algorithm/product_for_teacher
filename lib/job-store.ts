import { demoJob } from "./demo-data";
import type { GradingJob } from "./types";

const jobs = new Map<string, GradingJob>([[demoJob.id, demoJob]]);

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

export function saveJob(job: GradingJob) {
  jobs.set(job.id, job);
  return job;
}
