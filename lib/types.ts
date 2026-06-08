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

/** One step of Kimi's "重组复原" (reconstruction) of a handwritten answer, grounded
 *  to a region of the source image so a teacher can audit it against the crop. */
export interface ReconstructionStep {
  text: string;
  /** Roughly where in the image this step appears, e.g. "左上角第一行" or "[无法辨认]" for illegible content — never a guess at the content itself. */
  imageRegion: string;
}

/** Whether a single rubric scoring-point was satisfied, with a citation back to
 *  the reconstruction (or an explicit "未找到依据") rather than a re-derived guess. */
export interface PointCheck {
  pointId: string;
  satisfied: boolean;
  evidence: string;
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
  /** Kimi's self-reported grading confidence (0-1) — used to route low-confidence
   *  results to teacher review instead of silently trusting a possibly-hallucinated score. */
  llmConfidence?: number;
  /** Kimi's "重组复原": its grounded transcription/reorganization of the handwritten
   *  answer, shown to teachers as an auditable artifact alongside the crop image. */
  reconstruction?: {
    steps: ReconstructionStep[];
    /** Kimi's self-rated confidence (0-1) in the *transcription* specifically — should be lower for messy/crossed-out/ambiguous handwriting. */
    transcriptionConfidence: number;
  };
  /** Per-rubric-point grading evidence, each citing back to `reconstruction`. */
  pointChecks?: PointCheck[];
  /** Heuristic divergence (0 = identical, 1 = totally different) between Kimi's
   *  reconstruction text and the worker's independent OCR `recognizedAnswer` — a
   *  large gap is itself a hallucination signal, independent of Kimi's self-reported confidence. */
  reconstructionDivergence?: number;
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
