import { NextResponse } from "next/server";
import { saveJob } from "@/lib/job-store";
import type { GradingJob } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    deviceId: string;
    taskId: string;
    imageUrl: string;
    imageType: "answer_sheet" | "student_sheet";
  };

  if (!body.deviceId || !body.taskId || !body.imageUrl || !body.imageType) {
    return NextResponse.json({ ok: false, error: "Missing required upload fields" }, { status: 400 });
  }

  const job: GradingJob = {
    id: body.taskId,
    status: "uploaded",
    subject: "语文",
    grade: "一年级下册",
    title: "硬件上传批改任务",
    studentName: body.deviceId,
    totalScore: 100,
    answerSheetUrl: body.imageType === "answer_sheet" ? body.imageUrl : "",
    studentSheetUrl: body.imageType === "student_sheet" ? body.imageUrl : "",
    rubrics: [],
    results: [],
    calibrationNotes: []
  };

  saveJob(job);

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    next: `/pipeline/${job.id}`
  });
}
