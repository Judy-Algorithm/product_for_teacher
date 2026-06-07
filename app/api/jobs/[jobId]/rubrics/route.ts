import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
import { getJobFromDatabase } from "@/lib/jobs/repository";
import type { QuestionRubric } from "@/lib/types";

export const runtime = "nodejs";

/** PUT /api/jobs/[jobId]/rubrics — save teacher-provided rubrics */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const body = (await request.json()) as { rubrics: QuestionRubric[] };

  if (!Array.isArray(body.rubrics)) {
    return NextResponse.json({ ok: false, error: "rubrics must be an array" }, { status: 400 });
  }

  const job = await getJobFromDatabase(jobId);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  const sql = getSql();
  await sql`
    UPDATE grading_jobs
    SET rubrics = ${JSON.stringify(body.rubrics)}::jsonb, updated_at = NOW()
    WHERE id = ${jobId}
  `;

  return NextResponse.json({ ok: true });
}
