import { getSql } from "@/lib/db/client";
import type { GradingJob, QuestionResult, QuestionRubric } from "@/lib/types";

let schemaReady = false;

export async function ensureJobsSchema() {
  if (schemaReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS grading_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      title TEXT NOT NULL,
      student_name TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      answer_sheet_url TEXT NOT NULL,
      student_sheet_url TEXT NOT NULL,
      corrected_sheet_url TEXT,
      rubrics JSONB NOT NULL DEFAULT '[]'::jsonb,
      results JSONB NOT NULL DEFAULT '[]'::jsonb,
      calibration_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  schemaReady = true;
}

export async function saveJobToDatabase(job: GradingJob) {
  await ensureJobsSchema();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO grading_jobs (
      id,
      status,
      subject,
      grade,
      title,
      student_name,
      total_score,
      answer_sheet_url,
      student_sheet_url,
      corrected_sheet_url,
      rubrics,
      results,
      calibration_notes
    )
    VALUES (
      ${job.id},
      ${job.status},
      ${job.subject},
      ${job.grade},
      ${job.title},
      ${job.studentName},
      ${job.totalScore},
      ${job.answerSheetUrl},
      ${job.studentSheetUrl},
      ${job.correctedSheetUrl ?? null},
      ${JSON.stringify(job.rubrics)}::jsonb,
      ${JSON.stringify(job.results)}::jsonb,
      ${JSON.stringify(job.calibrationNotes)}::jsonb
    )
    RETURNING id
  `) as Array<{ id: string }>;

  return rows[0]?.id as string;
}

interface JobRow {
  id: string;
  status: GradingJob["status"];
  subject: string;
  grade: string;
  title: string;
  student_name: string;
  total_score: number;
  answer_sheet_url: string;
  student_sheet_url: string;
  corrected_sheet_url: string | null;
  rubrics: QuestionRubric[];
  results: QuestionResult[];
  calibration_notes: string[];
}

export async function getJobFromDatabase(jobId: string): Promise<GradingJob | null> {
  await ensureJobsSchema();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      status,
      subject,
      grade,
      title,
      student_name,
      total_score,
      answer_sheet_url,
      student_sheet_url,
      corrected_sheet_url,
      rubrics,
      results,
      calibration_notes
    FROM grading_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `) as JobRow[];

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    subject: row.subject,
    grade: row.grade,
    title: row.title,
    studentName: row.student_name,
    totalScore: row.total_score,
    answerSheetUrl: row.answer_sheet_url,
    studentSheetUrl: row.student_sheet_url,
    correctedSheetUrl: row.corrected_sheet_url ?? undefined,
    rubrics: row.rubrics,
    results: row.results,
    calibrationNotes: row.calibration_notes
  };
}

export async function updateJobStatus(jobId: string, status: GradingJob["status"]) {
  await ensureJobsSchema();

  const sql = getSql();
  await sql`
    UPDATE grading_jobs
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

export async function updateJobResults(
  jobId: string,
  payload: {
    status: GradingJob["status"];
    results: GradingJob["results"];
    correctedSheetUrl?: string;
    /** Optionally persist rubrics auto-derived from OCR'ing the answer-key sheet. */
    rubrics?: GradingJob["rubrics"];
  }
) {
  await ensureJobsSchema();

  const sql = getSql();
  if (payload.rubrics) {
    await sql`
      UPDATE grading_jobs
      SET
        status = ${payload.status},
        results = ${JSON.stringify(payload.results)}::jsonb,
        rubrics = ${JSON.stringify(payload.rubrics)}::jsonb,
        corrected_sheet_url = ${payload.correctedSheetUrl ?? null},
        updated_at = NOW()
      WHERE id = ${jobId}
    `;
    return;
  }

  await sql`
    UPDATE grading_jobs
    SET
      status = ${payload.status},
      results = ${JSON.stringify(payload.results)}::jsonb,
      corrected_sheet_url = ${payload.correctedSheetUrl ?? null},
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}
