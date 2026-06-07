import { NextResponse } from "next/server";
import { autoGradeResults } from "@/lib/jobs/auto-grade-results";
import { mergeRubricsWithAnswerKey, type AnswerKeyEntry } from "@/lib/jobs/answer-key-rubrics";
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
    /**
     * Per-question OCR of the answer/rubric sheet — the worker now crops it with the
     * exact same question-region template as the student sheet (需求文档 5.4) and OCRs
     * each region, so we can build a real text-based rubric instead of falling back to
     * sending whole-page images to a vision model.
     */
    answerKey?: AnswerKeyEntry[] | null;
    correctedSheetUrl?: string;
  };

  const job = await getJobFromDatabase(body.jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  // Teacher-entered rubrics always win; OCR'd answer-key text only fills the gaps so
  // that Kimi has a real reference answer to grade against for every question
  // (需求文档 5.6 P0 "基于老师输入的标准答案和评分标准进行评分").
  const mergedRubrics = mergeRubricsWithAnswerKey(job.rubrics, body.answerKey);
  const jobForGrading = { ...job, rubrics: mergedRubrics };

  const results = body.status === "failed" ? body.results : await autoGradeResults(jobForGrading, body.results);

  await updateJobResults(body.jobId, {
    status: body.status,
    results,
    correctedSheetUrl: body.correctedSheetUrl,
    rubrics: mergedRubrics
  });

  return NextResponse.json({ ok: true });
}
