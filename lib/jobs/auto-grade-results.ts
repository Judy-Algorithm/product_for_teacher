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
    reviewStatus: result.reviewStatus === "needs_rescan" ? "needs_rescan" : "auto_accepted"
  };
}

export async function autoGradeResults(
  job: Pick<GradingJob, "rubrics" | "calibrationNotes"> & { answerSheetUrl?: string },
  results: QuestionResult[],
  grade: GradeWithKimi = gradeWithKimi
) {
  const hasPublicAnswerSheet =
    Boolean(job.answerSheetUrl) && !job.answerSheetUrl!.startsWith("data:");

  return Promise.all(
    results.map(async (result) => {
      const rubric = job.rubrics.find((item) => item.questionId === result.questionId);

      if (!rubric) {
        // No rubric stored → fall back to Kimi Vision using the answer sheet image.
        if (hasPublicAnswerSheet) {
          try {
            const cropUrl = result.cropUrl?.startsWith("data:") ? undefined : result.cropUrl;
            const visionResult = await gradeWithKimiVision({
              questionLabel: questionIdToLabel(result.questionId),
              answerSheetUrl: job.answerSheetUrl!,
              cropUrl,
              recognizedAnswer: result.recognizedAnswer
            });
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
        const kimiResult = await grade({
          questionId: result.questionId,
          fullScore: rubric.fullScore,
          standardAnswer: rubric.standardAnswer,
          rubric: rubric.standardSummary,
          studentAnswer: result.recognizedAnswer,
          calibration: job.calibrationNotes.join("\\n")
        });
        return applyKimiResult(result, kimiResult, rubric.fullScore);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kimi grading failed";
        return fallbackResult(result, `Kimi 评分失败：${message}`);
      }
    })
  );
}
