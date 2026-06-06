import { NextResponse } from "next/server";
import { getJobFromDatabase, updateJobResults } from "@/lib/jobs/repository";
import type { QuestionResult } from "@/lib/types";

export async function POST(request: Request) {
  const expectedSecret = process.env.WORKER_CALLBACK_SECRET;
  if (expectedSecret) {
    const receivedSecret = request.headers.get("x-worker-secret");
    if (receivedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Invalid worker secret" }, { status: 401 });
    }
  }

  const body = (await request.json()) as {
    jobId: string;
    status: "needs_review" | "done" | "failed";
    results: QuestionResult[];
    correctedSheetUrl?: string;
  };

  const job = await getJobFromDatabase(body.jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  await updateJobResults(body.jobId, {
    status: body.status,
    results: body.results,
    correctedSheetUrl: body.correctedSheetUrl
  });

  return NextResponse.json({ ok: true });
}
