import { describe, expect, it } from "vitest";
import type { QuestionRubric } from "@/lib/types";
import { mergeRubricsWithAnswerKey } from "./answer-key-rubrics";

const teacherRubric: QuestionRubric = {
  questionId: "q1",
  label: "第一题",
  type: "short_answer",
  fullScore: 5,
  standardAnswer: "老师手写的标准答案",
  standardSummary: "老师的评分要点",
  points: [],
  deductionRules: []
};

describe("mergeRubricsWithAnswerKey", () => {
  it("returns existing rubrics untouched when there is no answer key", () => {
    expect(mergeRubricsWithAnswerKey([teacherRubric], null)).toEqual([teacherRubric]);
    expect(mergeRubricsWithAnswerKey([teacherRubric], [])).toEqual([teacherRubric]);
  });

  it("keeps the teacher's rubric when they already filled in a standard answer", () => {
    const merged = mergeRubricsWithAnswerKey(
      [teacherRubric],
      [{ questionId: "q1", label: "第一题", recognizedAnswer: "答案卷OCR文本", ocrConfidence: 0.9 }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].standardAnswer).toBe("老师手写的标准答案");
  });

  it("fills in a rubric from OCR'd answer-key text when the teacher left it blank", () => {
    const blankRubric: QuestionRubric = { ...teacherRubric, standardAnswer: "", standardSummary: "" };
    const merged = mergeRubricsWithAnswerKey(
      [blankRubric],
      [{ questionId: "q1", label: "第一题", recognizedAnswer: "答案卷OCR识别出的参考答案", ocrConfidence: 0.88 }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].standardAnswer).toBe("答案卷OCR识别出的参考答案");
    expect(merged[0].fullScore).toBe(5);
    expect(merged[0].standardSummary).toContain("OCR 置信度");
  });

  it("creates a brand-new rubric for questions the teacher never entered", () => {
    const merged = mergeRubricsWithAnswerKey(
      [],
      [{ questionId: "q2", label: "第二题", recognizedAnswer: "前后；花朵；因为；运动", ocrConfidence: 0.92 }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      questionId: "q2",
      label: "第二题",
      standardAnswer: "前后；花朵；因为；运动",
      fullScore: 10
    });
  });

  it("notes when the answer-key region had no recognizable text", () => {
    const merged = mergeRubricsWithAnswerKey([], [{ questionId: "q3", recognizedAnswer: "" }]);

    expect(merged[0].standardAnswer).toBe("");
    expect(merged[0].standardSummary).toContain("未识别到文字");
  });
});
