import type { GradingJob } from "@/lib/types";

export interface CreateUploadJobInput {
  studentSheetUrl: string;
  answerSheetUrl: string;
}

export function createUploadJob(input: CreateUploadJobInput): GradingJob {
  const studentSheetUrl = input.studentSheetUrl.trim();
  const answerSheetUrl = input.answerSheetUrl.trim();

  if (!studentSheetUrl) {
    throw new Error("Student sheet URL is required");
  }

  if (!answerSheetUrl) {
    throw new Error("Answer sheet URL is required");
  }

  return {
    id: crypto.randomUUID(),
    status: "uploaded",
    subject: "语文",
    grade: "待识别",
    title: "本地上传批改任务",
    studentName: "待填写",
    totalScore: 100,
    answerSheetUrl,
    studentSheetUrl,
    rubrics: [],
    results: [],
    calibrationNotes: []
  };
}
