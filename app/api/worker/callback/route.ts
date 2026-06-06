import { NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/job-store";
import type { QuestionResult } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    jobId: string;
    status: "needs_review" | "done" | "failed";
    results: QuestionResult[];
    correctedSheetUrl?: string;
  };

  const job = getJob(body.jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const updatedJob = saveJob({
    ...job,
    status: body.status,
    results: body.results,
    correctedSheetUrl: body.correctedSheetUrl
  });

  return NextResponse.json({ ok: true, job: updatedJob });
}
