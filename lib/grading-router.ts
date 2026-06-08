import type { GradingRoute, QuestionType } from "./types";

const ruleTypes: QuestionType[] = ["copy_sentence", "word", "choice", "word_building"];

/**
 * Below this, Kimi's own self-reported grading confidence is treated as too low
 * to trust unattended — route to the teacher instead of silently accepting a
 * possibly-hallucinated score. This is a conservative starting point; once we
 * have enough teacher-correction data we should calibrate it against real
 * agreement rates (see `reconstruction`/`pointChecks` in QuestionResult, which
 * exist specifically to build that dataset).
 */
export const LOW_LLM_CONFIDENCE_THRESHOLD = 0.6;

export function chooseGradingRoute(type: QuestionType, ocrConfidence: number, llmConfidence?: number): GradingRoute {
  if (ocrConfidence < 0.75) return "teacher_review";
  if (llmConfidence !== undefined && llmConfidence < LOW_LLM_CONFIDENCE_THRESHOLD) return "teacher_review";
  if (ruleTypes.includes(type)) return "rule";
  return "llm";
}
