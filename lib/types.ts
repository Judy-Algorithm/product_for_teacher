export type QuestionType =
  | "copy_sentence"
  | "word"
  | "choice"
  | "word_building"
  | "short_answer";

export type GradingRoute = "rule" | "llm" | "teacher_review";

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
  teacherComment: string;
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
