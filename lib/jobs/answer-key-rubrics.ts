import type { QuestionRubric } from "@/lib/types";

/**
 * One question's OCR result from the *answer/rubric sheet* — produced by the Python
 * worker running the exact same crop-template + OCR pipeline it uses for the student
 * sheet (需求文档 5.4: "支持将答案卷题目区域映射到学生卷"). Having this lets the
 * backend grade with plain text comparison (gradeWithKimi) instead of shipping whole
 * page images to a vision model.
 */
export interface AnswerKeyEntry {
  questionId: string;
  label?: string;
  recognizedAnswer: string;
  ocrConfidence?: number;
  cropUrl?: string;
}

const LABELS = [
  "第一题", "第二题", "第三题", "第四题", "第五题", "第六题",
  "第七题", "第八题", "第九题", "第十题", "第十一题", "第十二题",
];

const DEFAULT_FULL_SCORE = 10;

function fallbackLabel(questionId: string, index: number): string {
  return LABELS[index] ?? questionId;
}

/**
 * Merge teacher-authored rubrics (from RubricEditor, takes precedence whenever the
 * teacher actually filled in a standard answer) with rubrics auto-derived from OCR'ing
 * the answer-key sheet (used as a fallback so Kimi always has *some* reference text to
 * grade against, fulfilling 需求文档 5.6 P0 "基于老师输入的标准答案和评分标准进行评分"
 * while still degrading gracefully when the teacher hasn't typed anything in).
 */
export function mergeRubricsWithAnswerKey(
  existingRubrics: QuestionRubric[],
  answerKey: AnswerKeyEntry[] | null | undefined
): QuestionRubric[] {
  if (!answerKey || answerKey.length === 0) return existingRubrics;

  const byId = new Map(existingRubrics.map((rubric) => [rubric.questionId, rubric]));

  answerKey.forEach((entry, index) => {
    const existing = byId.get(entry.questionId);
    const teacherFilledIn = Boolean(existing?.standardAnswer?.trim());
    if (teacherFilledIn) return;

    const recognized = entry.recognizedAnswer?.trim() ?? "";
    byId.set(entry.questionId, {
      questionId: entry.questionId,
      label: existing?.label || entry.label || fallbackLabel(entry.questionId, index),
      type: existing?.type ?? "short_answer",
      fullScore: existing?.fullScore || DEFAULT_FULL_SCORE,
      standardAnswer: recognized || existing?.standardAnswer || "",
      standardSummary:
        existing?.standardSummary ||
        (recognized
          ? `根据答案卷自动识别（OCR 置信度 ${Math.round((entry.ocrConfidence ?? 0) * 100)}%），请老师核对后再批改。`
          : "答案卷该题区域未识别到文字，建议老师补充标准答案。"),
      points: existing?.points ?? [],
      deductionRules: existing?.deductionRules ?? [],
    });
  });

  return Array.from(byId.values());
}
