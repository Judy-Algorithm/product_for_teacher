import { describe, expect, it } from "vitest";
import { chooseGradingRoute } from "./grading-router";

describe("chooseGradingRoute", () => {
  it("uses rules for simple teacher-facing question types with high OCR confidence", () => {
    expect(chooseGradingRoute("copy_sentence", 0.95)).toBe("rule");
    expect(chooseGradingRoute("word", 0.92)).toBe("rule");
    expect(chooseGradingRoute("choice", 0.88)).toBe("rule");
  });

  it("asks the teacher to review low confidence OCR", () => {
    expect(chooseGradingRoute("choice", 0.62)).toBe("teacher_review");
  });

  it("uses the LLM only for complex answers after OCR is reliable enough", () => {
    expect(chooseGradingRoute("short_answer", 0.91)).toBe("llm");
  });
});
