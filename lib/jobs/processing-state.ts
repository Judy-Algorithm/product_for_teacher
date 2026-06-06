import type { GradingJob } from "@/lib/types";

export function shouldPollJob(job: Pick<GradingJob, "status" | "results">) {
  return job.status === "processing" && job.results.length === 0;
}
