import { gradeWithKimi, gradeWithKimiVision, type KimiGradeResult } from "../kimi";
import type { GradingJob, QuestionResult } from "../types";

type GradeWithKimi = typeof gradeWithKimi;

const QUESTION_ID_TO_LABEL: Record<string, string> = {
  q1: "第一题", q2: "第二题", q3: "第三题", q4: "第四题",
  q5: "第五题", q6: "第六题", q7: "第七题", q8: "第八题",
  q9: "第九题", q10: "第十题", q11: "第十一题", q12: "第十二题",
};

function questionIdToLabel(questionId: string): string {
  if (QUESTION_ID_TO_LABEL[questionId]) return QUESTION_ID_TO_LABEL[questionId];
  const n = parseInt(questionId.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? questionId : `第${n}题`;
}

function fallbackResult(result: QuestionResult, reason: string): QuestionResult {
  return {
    ...result,
    route: "teacher_review",
    score: 0,
    reason,
    teacherComment: result.teacherComment || "请老师确认 OCR 结果和得分。",
    reviewStatus: result.reviewStatus === "needs_rescan" ? "needs_rescan" : "auto_accepted"
  };
}

function applyKimiResult(result: QuestionResult, kimiResult: KimiGradeResult, fullScore: number): QuestionResult {
  const boundedScore = Math.min(Math.max(kimiResult.score, 0), fullScore);
  return {
    ...result,
    route: "llm",
    score: boundedScore,
    reason: kimiResult.reason || "Kimi 已根据评分标准批改",
    teacherComment: result.teacherComment,
    reviewStatus: result.reviewStatus === "needs_rescan" ? "needs_rescan" : "auto_accepted",
    // Reflect the *real* token usage Moonshot reported for this call so the
    // technical-details panel proves Kimi actually ran (instead of always
    // showing the worker's 0/0/0 placeholder). savedByRouting stays 0 here —
    // this question went through the LLM, so nothing was "saved by routing".
    tokenEstimate: kimiResult.usage
      ? { input: kimiResult.usage.promptTokens, output: kimiResult.usage.completionTokens, savedByRouting: 0 }
      : result.tokenEstimate
  };
}

/**
 * Moonshot/Kimi accounts are capped at a small number of concurrent in-flight
 * requests ("max organization concurrency: 3"). Grading every question with an
 * unbounded `Promise.all` fired them all at once and most came back as
 * `429 rate_limit_reached_error`. Run at most `limit` gradings at a time.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return out;
}

const KIMI_CONCURRENCY = 2;

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("rate_limit");
}

/** Retry a Kimi call with exponential backoff when Moonshot returns a 429 (rate limit). */
async function withRateLimitRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === attempts - 1) {
        throw error;
      }
      const backoffMs = 1200 * 2 ** attempt + Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

export async function autoGradeResults(
  job: Pick<GradingJob, "rubrics" | "calibrationNotes"> & { answerSheetUrl?: string },
  results: QuestionResult[],
  grade: GradeWithKimi = gradeWithKimi
) {
  const hasPublicAnswerSheet =
    Boolean(job.answerSheetUrl) && !job.answerSheetUrl!.startsWith("data:");

  return mapWithConcurrency(results, KIMI_CONCURRENCY, async (result) => {
    const rubric = job.rubrics.find((item) => item.questionId === result.questionId);

    if (!rubric) {
      // No rubric stored → fall back to Kimi Vision using the answer sheet image.
      if (hasPublicAnswerSheet) {
        try {
          const visionResult = await withRateLimitRetry(() =>
            gradeWithKimiVision({
              questionLabel: questionIdToLabel(result.questionId),
              answerSheetUrl: job.answerSheetUrl!,
              cropUrl: result.cropUrl,
              recognizedAnswer: result.recognizedAnswer
            })
          );
          return applyKimiResult(result, visionResult, visionResult.fullScore);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Vision grading failed";
          return fallbackResult(result, `Kimi Vision 评分失败：${message}`);
        }
      }
      return fallbackResult(result, "暂无评分标准匹配，已展示 OCR 结果。");
    }

    if (!result.recognizedAnswer.trim()) {
      return fallbackResult(result, "OCR 未识别到答案，请老师复核。");
    }

    try {
      // `rubric.standardAnswer` is the OCR-extracted reference answer derived
      // from the answer sheet (see mergeRubricsWithAnswerKey) — Kimi always
      // receives it alongside the student's recognized answer so it can grade
      // as a teacher comparing the two, never "blind".
      const kimiResult = await withRateLimitRetry(() =>
        grade({
          questionId: result.questionId,
          fullScore: rubric.fullScore,
          standardAnswer: rubric.standardAnswer,
          rubric: rubric.standardSummary,
          studentAnswer: result.recognizedAnswer,
          calibration: job.calibrationNotes.join("\\n")
        })
      );
      return applyKimiResult(result, kimiResult, rubric.fullScore);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kimi grading failed";
      return fallbackResult(result, `Kimi 评分失败：${message}`);
    }
  });
}
