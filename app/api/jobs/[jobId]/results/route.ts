import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
import { getJobFromDatabase } from "@/lib/jobs/repository";
import type { ErrorType, QuestionResult } from "@/lib/types";
import { ERROR_TYPES } from "@/lib/types";

export const runtime = "nodejs";

/** PATCH /api/jobs/[jobId]/results — save teacher score overrides */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const body = (await request.json()) as {
    questionId: string;
    score: number;
    reason: string;
    errorType?: string;
  };

  if (!body.questionId) {
    return NextResponse.json({ ok: false, error: "questionId required" }, { status: 400 });
  }

  const errorType: ErrorType | undefined =
    body.errorType && (ERROR_TYPES as readonly string[]).includes(body.errorType)
      ? (body.errorType as ErrorType)
      : undefined;

  const job = await getJobFromDatabase(jobId);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  const original = job.results.find((r) => r.questionId === body.questionId);

  const updated: QuestionResult[] = job.results.map((r) =>
    r.questionId === body.questionId
      ? {
          ...r,
          score: body.score,
          reason: body.reason,
          errorType: errorType ?? r.errorType,
          reviewStatus: "teacher_modified" as const,
        }
      : r
  );

  // 需求文档 5.6 P0：「支持前 3-5 份老师修正反馈影响后续评分」
  // 把老师的实际修正（分数和/或理由的变化）记录为本任务的校准样本，
  // 之后调用 Kimi 评分时会把这些样本拼进 prompt，帮助后续题目更贴合老师的评分尺度。
  // 最多保留前 5 条，避免 prompt 无限增长。
  let calibrationNotes = job.calibrationNotes;
  if (original && (original.score !== body.score || original.reason !== body.reason) && calibrationNotes.length < 5) {
    const rubric = job.rubrics.find((r) => r.questionId === body.questionId);
    const label = rubric?.label ?? body.questionId;
    const errorTypeNote = errorType ? `，判错原因：${errorType}` : "";
    const note = `${label}：学生作答「${original.recognizedAnswer || "（未识别到文字）"}」，AI 原判 ${original.score} 分（${original.reason || "无说明"}），老师修正为 ${body.score} 分，理由：${body.reason || "未填写"}${errorTypeNote}`;
    calibrationNotes = [...calibrationNotes, note];
  }

  const sql = getSql();
  await sql`
    UPDATE grading_jobs
    SET results = ${JSON.stringify(updated)}::jsonb,
        calibration_notes = ${JSON.stringify(calibrationNotes)}::jsonb,
        updated_at = NOW()
    WHERE id = ${jobId}
  `;

  return NextResponse.json({ ok: true, calibrationNotes });
}

/** GET /api/jobs/[jobId]/results?format=csv — export grades as CSV */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const job = await getJobFromDatabase(jobId);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  if (format === "csv") {
    const labelMap = new Map(job.rubrics.map((r) => [r.questionId, r.label]));
    const fullScoreMap = new Map(job.rubrics.map((r) => [r.questionId, r.fullScore]));

    const rows = [
      ["题号", "得分", "满分", "批改原因", "错误类型", "批改状态"].join(","),
      ...job.results.map((r) => {
        const label = labelMap.get(r.questionId) ?? r.questionId;
        const full = fullScoreMap.get(r.questionId) ?? "-";
        const status =
          r.reviewStatus === "teacher_modified"
            ? "老师修改"
            : r.reviewStatus === "needs_rescan"
              ? "需重拍"
              : "AI自动";
        return [
          label,
          r.score,
          full,
          `"${r.reason.replace(/"/g, '""')}"`,
          r.errorType ?? "",
          status,
        ].join(",");
      }),
      "",
      ["合计", job.results.reduce((s, r) => s + r.score, 0), "", "", "", ""].join(","),
    ];

    const csv = rows.join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="grades-${jobId.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, results: job.results });
}
