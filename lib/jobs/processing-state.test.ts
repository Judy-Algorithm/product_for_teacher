import { describe, expect, it } from "vitest";
import { shouldPollJob } from "./processing-state";

describe("shouldPollJob", () => {
  it("polls only while a job is processing without OCR results", () => {
    expect(shouldPollJob({ status: "processing", results: [] })).toBe(true);
    expect(shouldPollJob({ status: "uploaded", results: [] })).toBe(false);
    expect(shouldPollJob({ status: "needs_review", results: [] })).toBe(false);
    expect(shouldPollJob({ status: "processing", results: [{} as never] })).toBe(false);
  });
});
