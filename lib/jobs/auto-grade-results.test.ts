import { describe, expect, it } from "vitest";
import type { KimiGradeResult } from "@/lib/kimi";
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

  it("forwards the OCR-derived standard answer to Kimi and records real token usage", async () => {
    const seenInputs: Array<{ standardAnswer: string; studentAnswer: string }> = [];
    const graded = await autoGradeResults(job, [result], async (input) => {
      seenInputs.push({ standardAnswer: input.standardAnswer, studentAnswer: input.studentAnswer });
      return { score: 4, reason: "基本正确", confidence: 0.8, usage: { promptTokens: 321, completionTokens: 42 } };
    });

    // Kimi must always receive the answer-key-derived reference text alongside
    // the student's OCR'd answer — otherwise it has nothing to grade against.
    expect(seenInputs).toEqual([{ standardAnswer: "标准答案", studentAnswer: "学生答案" }]);
    // The technical-details panel should reflect the *real* usage Kimi reported,
    // not the worker's 0/0/0 placeholder — proving Kimi actually ran.
    expect(graded[0].tokenEstimate).toEqual({ input: 321, output: 42, savedByRouting: 0 });
  });

  it("retries once on a 429 rate-limit error and still grades the question", async () => {
    let attempts = 0;
    const graded = await autoGradeResults(job, [result], async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("Kimi request failed: 429 rate_limit_reached_error: max organization concurrency: 3");
      }
      return { score: 5, reason: "重试后成功", confidence: 0.9 };
    });

    expect(attempts).toBe(2);
    expect(graded[0].route).toBe("llm");
    expect(graded[0].score).toBe(5);
    expect(graded[0].reason).toBe("重试后成功");
  });

  it("routes to teacher_review when Kimi reports low self-confidence, instead of silently trusting the score", async () => {
    // Kimi already returns a `confidence` field — it had been parsed and then
    // discarded. This proves it's now wired into the abstention decision: a
    // model that says "I'm not sure" should not have its score silently trusted.
    const graded = await autoGradeResults(job, [result], async () => ({
      score: 3,
      reason: "勉强算对",
      confidence: 0.3
    }));

    expect(graded[0].route).toBe("teacher_review");
    expect(graded[0].llmConfidence).toBe(0.3);
    expect(graded[0].teacherComment).toContain("置信度较低");
    // The score is still recorded (for the teacher to see/adjust), just not auto-accepted.
    expect(graded[0].score).toBe(3);
  });

  it("keeps the llm route when Kimi reports adequate self-confidence", async () => {
    const graded = await autoGradeResults(job, [result], async () => ({
      score: 4,
      reason: "基本正确",
      confidence: 0.85
    }));

    expect(graded[0].route).toBe("llm");
    expect(graded[0].llmConfidence).toBe(0.85);
  });

  it("flags high divergence between Kimi's grounded reconstruction and independent OCR text for teacher review", async () => {
    // `result.recognizedAnswer` is "学生答案". A vision-graded result whose
    // "重组复原" reads as something completely unrelated is exactly the
    // hallucination this cross-check exists to catch — even when Kimi itself
    // reports high confidence (a model can be "confidently" wrong).
    const graded = await autoGradeResults(job, [result], async () => {
      const fakeVisionShapedResult = {
        score: 4,
        reason: "基本正确",
        confidence: 0.95,
        reconstruction: {
          steps: [{ text: "由 Q 在第三象限知 b，联立方程组解得 t = ±2√5/5，与原题完全无关的内容", imageRegion: "左上角第一行" }],
          transcriptionConfidence: 0.9
        },
        pointChecks: []
      };
      // The injected `grade` is typed to return `KimiGradeResult`, but
      // `applyKimiResult` (shared by both the rubric and vision grading paths)
      // reads `reconstruction`/`pointChecks` off whatever object actually arrives
      // at runtime — exactly what `gradeWithKimiVision` returns in production.
      return fakeVisionShapedResult as unknown as KimiGradeResult;
    });

    expect(graded[0].route).toBe("teacher_review");
    expect(graded[0].reconstructionDivergence).toBeGreaterThan(0.7);
    expect(graded[0].teacherComment).toContain("差异较大");
    expect(graded[0].reconstruction?.steps).toHaveLength(1);
  });

  it("processes many questions with bounded concurrency and preserves result order", async () => {
    const manyResults: QuestionResult[] = Array.from({ length: 6 }, (_, index) => ({
      ...result,
      questionId: `q${index + 1}`,
      recognizedAnswer: `学生答案${index + 1}`
    }));
    const manyJob: Pick<GradingJob, "rubrics" | "calibrationNotes"> = {
      calibrationNotes: [],
      rubrics: manyResults.map((item, index) => ({
        questionId: item.questionId,
        label: `第${index + 1}题`,
        type: "word",
        fullScore: 10,
        standardAnswer: `标准答案${index + 1}`,
        standardSummary: "按标准答案给分",
        points: [],
        deductionRules: []
      }))
    };

    let inFlight = 0;
    let maxInFlight = 0;
    const graded = await autoGradeResults(manyJob, manyResults, async (input) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      const n = Number(input.questionId.replace("q", ""));
      return { score: n, reason: `第${n}题得分`, confidence: 0.8 };
    });

    // Never exceed Moonshot's "max organization concurrency: 3" — we cap at 2.
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(graded.map((item) => item.questionId)).toEqual(["q1", "q2", "q3", "q4", "q5", "q6"]);
    expect(graded.map((item) => item.score)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
