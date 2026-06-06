import { NextResponse } from "next/server";
import { createUploadJob } from "@/lib/jobs/create-upload-job";
import { saveJobToDatabase } from "@/lib/jobs/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    studentSheetUrl?: string;
    answerSheetUrl?: string;
  };

  try {
    const job = createUploadJob({
      studentSheetUrl: body.studentSheetUrl ?? "",
      answerSheetUrl: body.answerSheetUrl ?? ""
    });

    await saveJobToDatabase(job);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      next: `/pipeline/${job.id}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job creation error";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
