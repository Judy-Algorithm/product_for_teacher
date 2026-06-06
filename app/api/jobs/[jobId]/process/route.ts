import { NextResponse } from "next/server";
import { getJobFromDatabase, updateJobStatus } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const maxDuration = 30;

function normalizeWorkerUrl(workerUrl: string) {
  return workerUrl.trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  let jobId = "";

  try {
    const resolvedParams = await params;
    jobId = resolvedParams.jobId;
    const workerUrl = normalizeWorkerUrl(process.env.PYTHON_WORKER_URL ?? "");

    if (!workerUrl) {
      return NextResponse.json({ ok: false, error: "PYTHON_WORKER_URL is not configured" }, { status: 500 });
    }

    const job = await getJobFromDatabase(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    await updateJobStatus(job.id, "processing");

    const response = await fetch(`${workerUrl}/process-async`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WORKER_CALLBACK_SECRET ? { "x-worker-secret": process.env.WORKER_CALLBACK_SECRET } : {})
      },
      body: JSON.stringify({
        jobId: job.id,
        studentSheetUrl: job.studentSheetUrl,
        answerSheetUrl: job.answerSheetUrl,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/api/worker/callback`,
        callbackSecret: process.env.WORKER_CALLBACK_SECRET ?? ""
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      await updateJobStatus(job.id, "failed");
      return NextResponse.json({ ok: false, error: `Worker failed: ${response.status} ${errorText}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, status: "processing" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker startup error";
    if (jobId) {
      try {
        await updateJobStatus(jobId, "failed");
      } catch {
        // Keep the API response JSON even if the failure status cannot be persisted.
      }
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
