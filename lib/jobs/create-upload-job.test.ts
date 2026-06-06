import { describe, expect, it } from "vitest";
import { createUploadJob } from "./create-upload-job";

describe("createUploadJob", () => {
  it("creates an uploaded grading job from two blob image URLs", () => {
    const job = createUploadJob({
      studentSheetUrl: "https://example.com/student.png",
      answerSheetUrl: "https://example.com/rubric.png"
    });

    expect(job.status).toBe("uploaded");
    expect(job.studentSheetUrl).toBe("https://example.com/student.png");
    expect(job.answerSheetUrl).toBe("https://example.com/rubric.png");
    expect(job.id).toBeTruthy();
  });

  it("requires both uploaded image URLs", () => {
    expect(() => createUploadJob({ studentSheetUrl: "", answerSheetUrl: "https://example.com/rubric.png" })).toThrow(
      "Student sheet URL is required"
    );
    expect(() => createUploadJob({ studentSheetUrl: "https://example.com/student.png", answerSheetUrl: "" })).toThrow(
      "Answer sheet URL is required"
    );
  });
});
