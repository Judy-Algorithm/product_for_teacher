import { describe, expect, it } from "vitest";
import type { QuestionResult, QuestionRubric } from "@/lib/types";
import { getDisplayRubric } from "./result-rubric";

const result: QuestionResult = {
  questionId: "q1",
  cropUrl: "https://example.com/q1.jpg",
  box: { x: 0, y: 0, width: 100, height: 50, confidence: 0.8 },
  recognizedAnswer: "识别文字",
  ocrConfidence: 0.9,
  route: "teacher_review",
  score: 0,
  reason: "等待确认",
  teacherComment: "",
  tokenEstimate: { input: 0, output: 0, savedByRouting: 0 }
};

describe("getDisplayRubric", () => {
  it("uses a matching rubric when one exists", () => {
    const rubric: QuestionRubric = {
      questionId: "q1",
      label: "自定义题目",
      type: "word",
      fullScore: 10,
      standardAnswer: "答案",
      standardSummary: "标准",
      points: [],
      deductionRules: []
    };

    expect(getDisplayRubric([rubric], result, 0)).toBe(rubric);
  });

  it("creates a display rubric when OCR results have no matching rubric", () => {
    const rubric = getDisplayRubric([], result, 1);

    expect(rubric.questionId).toBe("q1");
    expect(rubric.label).toBe("第二题");
    expect(rubric.standardAnswer).toBe("暂无评分标准匹配");
  });
});
