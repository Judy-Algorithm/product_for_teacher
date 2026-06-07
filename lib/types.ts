export type QuestionType =
  | "copy_sentence"
  | "word"
  | "choice"
  | "word_building"
  | "short_answer";

export type GradingRoute = "rule" | "llm" | "teacher_review";
export type CropConfidence = "high" | "medium" | "low";
export type ReviewStatus = "auto_accepted" | "teacher_modified" | "needs_rescan";

/**
 * 需求文档 4.5 / 5.6 P0：「标记 AI 判错原因」「支持输出错误类型」。
 * 老师修正分数时可从这套标准化错因里选择，便于沉淀错题统计和后续校准。
 */
export const ERROR_TYPES = [
  "无错误",
  "审题/题意理解错误",
  "知识点掌握不足",
  "书写潦草导致识别错误",
  "裁剪/版面定位错误",
  "评分标准理解偏差",
  "其他",
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface QuestionRubric {
  questionId: string;
  label: string;
  type: QuestionType;
  fullScore: number;
  standardAnswer: string;
  standardSummary: string;
  points: Array<{ id: string; text: string; score: number }>;
  deductionRules: Array<{ id: string; text: string; deduct: number }>;
}

export interface QuestionResult {
  questionId: string;
  cropUrl: string;
  box: CropBox;
  recognizedAnswer: string;
  ocrConfidence: number;
  route: GradingRoute;
  score: number;
  reason: string;
  teacherComment?: string;
  /** 老师标记的 AI 判错原因/错误类型分类（需求文档 4.5、5.6） */
  errorType?: ErrorType;
  cropConfidence?: CropConfidence;
  reviewStatus?: ReviewStatus;
  tokenEstimate: {
    input: number;
    output: number;
    savedByRouting: number;
  };
}

export interface GradingJob {
  id: string;
  status: "draft" | "uploaded" | "processing" | "needs_review" | "done" | "failed";
  subject: string;
  grade: string;
  title: string;
  studentName: string;
  totalScore: number;
  answerSheetUrl: string;
  studentSheetUrl: string;
  correctedSheetUrl?: string;
  rubrics: QuestionRubric[];
  results: QuestionResult[];
  calibrationNotes: string[];
}
