import { NextResponse } from "next/server";
import { getJobFromDatabase, updateJobStatus } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    if (job.studentSheetUrl.startsWith("data:") || job.answerSheetUrl.startsWith("data:")) {
      return NextResponse.json(
        {
          ok: false,
          error: "当前图片是本地内联预览，远程 Python worker 无法下载。请配置 BLOB_READ_WRITE_TOKEN 后重新上传图片。"
        },
        { status: 400 }
      );
    }

    await updateJobStatus(job.id, "processing");

    const response = await fetch(`${workerUrl}/process`, {
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

    const workerResponseText = await response.text();

    if (!response.ok) {
      await updateJobStatus(job.id, "failed");
      return NextResponse.json({ ok: false, error: `Worker failed: ${response.status} ${workerResponseText}` }, { status: 502 });
    }

    let workerResult: { status?: string } = {};
    try {
      workerResult = workerResponseText ? (JSON.parse(workerResponseText) as { status?: string }) : {};
    } catch {
      workerResult = {};
    }

    return NextResponse.json({ ok: true, status: workerResult.status ?? "needs_review" });
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
