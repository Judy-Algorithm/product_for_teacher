import { describe, expect, it } from "vitest";
import { estimateReconstructionDivergence } from "./kimi";

describe("estimateReconstructionDivergence", () => {
  it("returns 0 for identical text", () => {
    expect(estimateReconstructionDivergence("拍（拍手）村（村庄）", "拍（拍手）村（村庄）")).toBe(0);
  });

  it("returns a low score for near-identical text with minor OCR noise (punctuation/whitespace)", () => {
    const divergence = estimateReconstructionDivergence("拍 (拍手)、村(村庄)", "拍（拍手）村（村庄）");
    expect(divergence).toBeLessThan(0.3);
  });

  it("returns a high score for two essentially unrelated transcriptions", () => {
    // This is exactly the failure mode we're guarding against: Kimi's "grounded"
    // reconstruction landing far away from an independent OCR pass is a strong
    // hallucination signal — whichever one is wrong, a teacher should look.
    const divergence = estimateReconstructionDivergence(
      "由 Q 在第三象限知 b，y2<0，联立方程组解得 t = ±2√5/5",
      "5.过；zháo yáng zì；wán chéng lión xi；L"
    );
    expect(divergence).toBeGreaterThan(0.7);
  });

  it("treats one-empty / both-empty strings sensibly", () => {
    expect(estimateReconstructionDivergence("", "")).toBe(0);
    expect(estimateReconstructionDivergence("有内容", "")).toBe(1);
    expect(estimateReconstructionDivergence("", "有内容")).toBe(1);
  });
});
