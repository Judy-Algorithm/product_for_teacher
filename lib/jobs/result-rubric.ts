import type { QuestionResult, QuestionRubric } from "@/lib/types";

const labels = ["第一题", "第二题", "第三题", "第四题", "第五题", "第六题", "第七题", "第八题", "第九题", "第十题"];

export function getDisplayRubric(rubrics: QuestionRubric[], result: QuestionResult, index: number): QuestionRubric {
  const rubric = rubrics.find((item) => item.questionId === result.questionId);
  if (rubric) return rubric;

  return {
    questionId: result.questionId,
    label: labels[index] ?? result.questionId,
    type: "short_answer",
    fullScore: Math.max(result.score, 0),
    standardAnswer: "暂无评分标准匹配",
    standardSummary: "已展示 OpenCV 裁剪和 OCR 识别结果，等待老师确认。",
    points: [],
    deductionRules: []
  };
}
