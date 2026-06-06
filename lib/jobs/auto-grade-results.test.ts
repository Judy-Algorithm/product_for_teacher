import { describe, expect, it } from "vitest";
import type { GradingJob, QuestionResult } from "@/lib/types";
import { autoGradeResults } from "./auto-grade-results";

const result: QuestionResult = {
  questionId: "q1",
  cropUrl: "https://example.com/q1.jpg",
  box: { x: 0, y: 0, width: 100, height: 50, confidence: 0.8 },
  recognizedAnswer: "学生答案",
  ocrConfidence: 0.9,
  route: "rule",
  score: 0,
  reason: "等待规则评分或老师确认",
  teacherComment: "",
  tokenEstimate: { input: 0, output: 0, savedByRouting: 0 }
};

const job: Pick<GradingJob, "rubrics" | "calibrationNotes"> = {
  calibrationNotes: [],
  rubrics: [
    {
      questionId: "q1",
      label: "第一题",
      type: "word",
      fullScore: 5,
      standardAnswer: "标准答案",
      standardSummary: "按标准答案给分",
      points: [],
      deductionRules: []
    }
  ]
};

describe("autoGradeResults", () => {
  it("calls Kimi when OCR results have matching rubrics", async () => {
    const calls: string[] = [];
    const graded = await autoGradeResults(job, [result], async (input) => {
      calls.push(input.questionId);
      return { score: 4, reason: "基本正确", confidence: 0.8 };
    });

    expect(calls).toEqual(["q1"]);
    expect(graded[0].score).toBe(4);
    expect(graded[0].route).toBe("llm");
    expect(graded[0].reason).toBe("基本正确");
  });

  it("keeps OCR visible for teacher review when no rubric matches", async () => {
    const graded = await autoGradeResults({ rubrics: [], calibrationNotes: [] }, [result], async () => {
      throw new Error("should not call kimi");
    });

    expect(graded[0].route).toBe("teacher_review");
    expect(graded[0].recognizedAnswer).toBe("学生答案");
    expect(graded[0].reason).toBe("暂无评分标准匹配，已展示 OCR 结果。");
  });
});
