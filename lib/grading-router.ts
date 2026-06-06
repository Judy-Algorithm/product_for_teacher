import type { GradingRoute, QuestionType } from "./types";

const ruleTypes: QuestionType[] = ["copy_sentence", "word", "choice", "word_building"];

export function chooseGradingRoute(type: QuestionType, ocrConfidence: number): GradingRoute {
  if (ocrConfidence < 0.75) return "teacher_review";
  if (ruleTypes.includes(type)) return "rule";
  return "llm";
}
