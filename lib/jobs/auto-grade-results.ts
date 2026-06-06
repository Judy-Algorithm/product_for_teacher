import { gradeWithKimi, type KimiGradeResult } from "../kimi";
import type { GradingJob, QuestionResult } from "../types";

type GradeWithKimi = typeof gradeWithKimi;

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
  job: Pick<GradingJob, "rubrics" | "calibrationNotes">,
  results: QuestionResult[],
  grade: GradeWithKimi = gradeWithKimi
) {
  return Promise.all(
    results.map(async (result) => {
      const rubric = job.rubrics.find((item) => item.questionId === result.questionId);
      if (!rubric) {
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
