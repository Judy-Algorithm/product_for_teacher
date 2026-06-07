import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
import { getJobFromDatabase } from "@/lib/jobs/repository";
import type { QuestionResult } from "@/lib/types";

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
  };

  if (!body.questionId) {
    return NextResponse.json({ ok: false, error: "questionId required" }, { status: 400 });
  }

  const job = await getJobFromDatabase(jobId);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  const updated: QuestionResult[] = job.results.map((r) =>
    r.questionId === body.questionId
      ? { ...r, score: body.score, reason: body.reason, reviewStatus: "teacher_modified" as const }
      : r
  );

  const sql = getSql();
  await sql`
    UPDATE grading_jobs
    SET results = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
    WHERE id = ${jobId}
  `;

  return NextResponse.json({ ok: true });
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
      ["题号", "得分", "满分", "批改原因", "批改状态"].join(","),
      ...job.results.map((r) => {
        const label = labelMap.get(r.questionId) ?? r.questionId;
        const full = fullScoreMap.get(r.questionId) ?? "-";
        const status =
          r.reviewStatus === "teacher_modified"
            ? "老师修改"
            : r.reviewStatus === "needs_rescan"
              ? "需重拍"
              : "AI自动";
        return [label, r.score, full, `"${r.reason.replace(/"/g, '""')}"`, status].join(",");
      }),
      "",
      ["合计", job.results.reduce((s, r) => s + r.score, 0), "", "", ""].join(","),
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
